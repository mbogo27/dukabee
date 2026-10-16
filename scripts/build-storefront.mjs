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
  const files = [...result.files, ...assets, ...images, ...brand];

  const leaks = privacyLeaks(files, catalog.products);
  if (leaks.length) throw new BuildError(`${id}: private cost would be published\n${leaks.map((l) => `  ✗ ${l}`).join('\n')}`);

  fs.mkdirSync(outDir, { recursive: true });
  for (const e of fs.readdirSync(outDir)) fs.rmSync(path.join(outDir, e), { recursive: true, force: true });
  for (const f of files) {
    const target = path.join(outDir, f.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.content);
  }
  return { ...result, files, outDir };
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
