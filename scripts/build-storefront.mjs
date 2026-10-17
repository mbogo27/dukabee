// Build a v2 storefront (data/<id>/ + guides) into dist/stores/<id>/, served at its own subdomain by worker/index.mjs.
//
//   node scripts/build-storefront.mjs dobatron            # → dist/stores/dobatron
//   node scripts/build-storefront.mjs dobatron --out tmp  # elsewhere (tests)
//
// Fails on guide errors (unknown embed slug, with file:line) and if any private supplier cost reaches the output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonCatalogSource, FileContentSource } from '../kiwanda/v2/source.mjs';
import { composeStorefront } from '../kiwanda/v2/pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export class BuildError extends Error {}

/** Every output file must be free of `cost` keys and of the supplier cost figures themselves (spec ground rule 6). */
export function privacyLeaks(files, rawProducts) {
  const prices = new Set(rawProducts.map((p) => p.price));
  const figures = [...new Set(rawProducts.map((p) => p.cost).filter((c) => c != null && !prices.has(c)))];
  const figureRe = figures.length ? new RegExp(`(?<![\\d.])(${figures.map((c) => String(c).replace('.', '\\.')).join('|')})(?![\\d])`) : null;
  const leaks = [];
  for (const f of files) {
    if (f.binary) continue;
    const text = typeof f.content === 'string' ? f.content : f.content.toString('utf8');
    if (/["']cost["']\s*:/.test(text)) leaks.push(`${f.path}: contains a "cost" key`);
    const m = figureRe && text.match(figureRe);
    if (m) leaks.push(`${f.path}: contains supplier cost ${m[1]}`);
  }
  return leaks;
}

// ---- redirects.csv: the committed redirect map (old_path,new_path) that drives every 301 ----
const CSV_HEADER = 'old_path,new_path';
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function readRedirectsCsv(file) {
  if (!fs.existsSync(file)) return {};
  const rows = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const m = line.match(/^("(?:[^"]|"")*"|[^,]*),("(?:[^"]|"")*"|.*)$/);
    const un = (s) => (s.startsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s);
    if (m) rows[un(m[1])] = un(m[2]);
  }
  return rows;
}
/**
 * Merge the build's generated redirects (every offer's old /p/ URL, /shop, renamed guides) into redirects.csv:
 * rows already in the CSV win (hand edits stick), new ones are added, and the file is written back sorted.
 * Every target must be a built page (no chains, no 404s).
 */
export function syncRedirects(file, generated, pagePaths) {
  const rows = { ...generated, ...readRedirectsCsv(file) };
  const problems = [];
  for (const [from, to] of Object.entries(rows)) {
    const target = to.split('?')[0];
    if (rows[target]) problems.push(`${from} → ${to} would chain into another redirect (${target} → ${rows[target]})`);
    else if (!pagePaths.has(target)) problems.push(`${from} → ${to}: ${target} is not a page on the site`);
    if (pagePaths.has(from)) problems.push(`${from} is a live page, so it can't also redirect`);
  }
  const sorted = Object.keys(rows).sort();
  fs.writeFileSync(file, `${CSV_HEADER}\n${sorted.map((k) => `${csvCell(k)},${csvCell(rows[k])}`).join('\n')}\n`);
  return { redirects: Object.fromEntries(sorted.map((k) => [k, rows[k]])), problems };
}

export async function buildStorefront(id, { outDir = path.join(ROOT, 'dist', 'stores', id), dataDir = path.join(ROOT, 'data', id), log = console.log } = {}) {
  const catalog = new JsonCatalogSource(dataDir);
  const content = new FileContentSource(path.join(dataDir, 'guides'), path.join(dataDir, 'pages'));
  const result = await composeStorefront({ catalog, content, relFile: (f) => path.relative(ROOT, f).replace(/\\/g, '/') });
  for (const w of result.warnings) log(`  ⚠ ${w}`);
  if (result.errors.length) throw new BuildError(`${id}: ${result.errors.length} error(s)\n${result.errors.map((e) => `  ✗ ${e}`).join('\n')}`);

  const assets = [
    ['assets/storefront.css', 'kiwanda/runtime/storefront.css'],
    ['assets/storefront.js', 'kiwanda/runtime/storefront.js'],
    ['assets/catalog.mjs', 'kiwanda/v2/catalog.mjs'],
  ].map(([to, from]) => ({ path: to, content: fs.readFileSync(path.join(ROOT, from), 'utf8') }));
  // Product photos (scripts/dobatron-images.py writes them as WebP into data/<id>/images/), served at /images/.
  const imgDir = path.join(dataDir, 'images');
  const images = fs.existsSync(imgDir) ? fs.readdirSync(imgDir).filter((f) => /\.(webp|jpe?g|png|avif)$/i.test(f)).map((f) => ({ path: `images/${f}`, content: fs.readFileSync(path.join(imgDir, f)), binary: true })) : [];
  for (const m of catalog.models) for (const img of m.images || []) {
    if (img.src && !images.some((i) => `/${i.path}` === img.src)) throw new BuildError(`${id}: ${m.modelId} points at ${img.src}, which isn't in data/${id}/images/`);
  }
  // Logo and favicon set (scripts/dobatron-brand.py writes them into data/<id>/brand/), served at /brand/.
  const brandDir = path.join(dataDir, 'brand');
  const brand = fs.existsSync(brandDir) ? fs.readdirSync(brandDir).filter((f) => /\.(png|ico|svg|webp)$/i.test(f)).map((f) => ({ path: `brand/${f}`, content: fs.readFileSync(path.join(brandDir, f)), binary: true })) : [];
  const ico = brand.find((f) => f.path === 'brand/favicon.ico');
  if (ico) brand.push({ ...ico, path: 'favicon.ico' }); // browsers ask for /favicon.ico on their own
  const store = (await catalog.getStore()).brand || {};
  for (const ref of [store.logo?.src, store.logoOnDark?.src, ...Object.values(store.icons || {})].filter(Boolean)) {
    if (!brand.some((f) => `/${f.path}` === ref)) throw new BuildError(`${id}: store.brand points at ${ref}, which isn't in data/${id}/brand/ (run scripts/dobatron-brand.py)`);
  }
  // Redirects are driven by data/<id>/redirects.csv (committed); redirects.json is the server-side copy of it.
  const pagePaths = new Set(result.files.filter((f) => f.path.endsWith('.html') && f.path !== '404.html').map((f) => (f.path === 'index.html' ? '/' : `/${f.path.replace(/\.html$/, '')}`)));
  const { redirects, problems } = syncRedirects(path.join(dataDir, 'redirects.csv'), result.redirects || {}, pagePaths);
  if (problems.length) throw new BuildError(`${id}: redirects.csv has ${problems.length} problem(s)\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`);
  const generated = result.files.filter((f) => f.path !== 'redirects.json');
  generated.push({ path: 'redirects.json', content: `${JSON.stringify(redirects, null, 1)}\n` });
  const files = [...generated, ...assets, ...images, ...brand];

  const leaks = privacyLeaks(files, catalog.products);
  if (leaks.length) throw new BuildError(`${id}: private cost would be published\n${leaks.map((l) => `  ✗ ${l}`).join('\n')}`);

  fs.mkdirSync(outDir, { recursive: true });
  for (const e of fs.readdirSync(outDir)) fs.rmSync(path.join(outDir, e), { recursive: true, force: true });
  for (const f of files) {
    const target = path.join(outDir, f.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.content);
  }
  return { ...result, redirects, files, outDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const id = args[0] || 'dobatron';
  const oi = args.indexOf('--out');
  const outDir = oi >= 0 ? path.resolve(args[oi + 1]) : undefined;
  try {
    const r = await buildStorefront(id, { outDir });
    const pages = r.files.filter((f) => f.path.endsWith('.html')).length;
    console.log(`  ✓ store ${id}: ${pages} pages, ${r.homeSections.length} homepage sections${r.warnings.length ? `, ${r.warnings.length} warning(s)` : ''} → ${path.relative(ROOT, r.outDir)}`);
  } catch (e) {
    console.error(e instanceof BuildError ? `✗ ${e.message}` : e);
    process.exit(1);
  }
}
