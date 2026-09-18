// Duka Bee pipeline: inventory → brand.md → vault → compose → pages. Headless; the studio and the CLI
// both call runPipeline() and just listen to its events.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBrandMd, parseBrandMd } from './brandmd.mjs';
import { expandVault } from './vault.mjs';
import { safeColors } from './contrast.mjs';
import { composeSite } from '../kiwanda/pages.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEMOS = ['kladi', 'jikoni', 'rembo'];
export const VERTICALS = { kladi: 'Clothes', jikoni: 'Kitchen', rembo: 'Cosmetics' };

const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
const now = () => performance.now();

export async function runPipeline(demo, { onEvent = () => {}, pace = 0 } = {}) {
  if (!DEMOS.includes(demo)) throw new Error(`Unknown demo "${demo}"`);
  const out = path.join(ROOT, 'out', demo);
  const siteDir = path.join(out, 'site');
  const wait = () => (pace ? new Promise((r) => setTimeout(r, pace)) : null);
  const stageTimes = {};
  let t0;
  const start = async (stage, message) => { t0 = now(); onEvent({ type: 'stage', stage, status: 'running', message }); await wait(); };
  const log = (stage, message) => onEvent({ type: 'log', stage, message });
  const done = (stage, summary, data) => { stageTimes[stage] = Math.round(now() - t0); onEvent({ type: 'stage', stage, status: 'done', ms: stageTimes[stage], summary, data }); };

  // 1. Inventory — the snapshot imported from the Taskbee project.
  await start('inventory', 'Reading existing Taskbee demo data');
  const sourceFile = path.join(ROOT, 'sources', demo, 'source.json');
  if (!fs.existsSync(sourceFile)) throw new Error(`No snapshot for ${demo}. Run "npm run import" first.`);
  const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const mapping = await import(`./mappings/${demo}.mjs`);
  const categories = [...new Set(source.products.map((p) => p.category))];
  log('inventory', `${source.products.length} catalog products · ${categories.length} categories · ${source.products.filter((p) => p.rawDescription).length} with raw scrape evidence`);
  log('inventory', `store copy: "${source.store.heroTitle}" · WhatsApp +${source.store.whatsapp}`);
  done('inventory', `${source.products.length} products, ${source.products.length} images`, { products: source.products.length, categories });

  // 2. Compress to brand.md.
  await start('brand', 'Compressing store details to brand.md');
  const findings = [...mapping.findings.map((f) => ({ ...f, from: 'mapping' }))];
  if (source.missingRaw?.length) log('brand', `${source.missingRaw.length} product(s) without raw scrape match`);
  if (demo === 'kladi' && source.store.excludedLukuProducts) {
    findings.push({ severity: 'decision', from: 'inventory', text: `The Taskbee "Kladi" page also mixes in ${source.store.excludedLukuProducts} Luku products whose photos are shared placeholders (e.g. one striped-polo render reused for 8 different shirts). Only the 21 Kladi products with verified photos were imported.` });
  }
  // Token safety: check every rendered text/background pair and force a safe value before brand.md is written.
  const safe = safeColors(mapping.brand.tokens);
  for (const f of safe.fixes) {
    log('brand', `contrast ${f.pair}: ${f.before}:1 ✗ → ${f.to} (${f.after}:1)`);
    findings.push({ severity: 'decision', from: 'brand', text: `Token safety: "${f.pair}" was ${f.before}:1; ${f.from} → ${f.to} (${f.after}:1).` });
  }
  if (!safe.fixes.length) log('brand', 'contrast: all text/background token pairs ≥ 4.5:1 ✓');
  const safeMapping = { ...mapping, brand: { ...mapping.brand, tokens: safe.color } };
  const brandMd = writeBrandMd({ source, mapping: safeMapping, productCount: mapping.products.filter((p) => !p.mergeInto).length, categories: [...new Set(mapping.products.flatMap((p) => (p.attributes || []).filter((a) => a.key === 'category').map((a) => a.values[0].value)))] });
  write(path.join(out, 'brand.md'), brandMd);
  const brandDoc = parseBrandMd(brandMd);
  const tk = brandDoc.tokens;
  log('brand', `${Object.keys(tk).length} tokens · display ${tk['type.display']} · hero ${tk['layout.hero']}`);
  done('brand', `${Object.keys(tk).length} tokens, ${tk['type.display']}`, { tokens: tk });

  // 3. Expand to the Ramani vault.
  await start('vault', 'Expanding brand.md + catalog into vault entities');
  const vault = expandVault({ demo, brandDoc, source, mapping });
  findings.push(...vault.problems.map((p) => ({ ...p, from: 'vault' })));
  fs.rmSync(path.join(out, 'vault'), { recursive: true, force: true });
  write(path.join(out, 'vault', 'shop.json'), JSON.stringify(vault.shop, null, 2));
  for (const p of vault.products) write(path.join(out, 'vault', 'products', `${p.slug}.json`), JSON.stringify(p, null, 2));
  const flagCount = (flag) => new Set(vault.products.flatMap((p) => p.attributes.filter((a) => a[flag]).map((a) => a.key)));
  const filterable = [...flagCount('filterable')];
  const selectable = [...flagCount('selectable')];
  const assumed = vault.products.filter((p) => p.attributes.some((a) => a.assumed)).length;
  const withChoice = vault.products.filter((p) => p.attributes.some((a) => a.selectable)).length;
  log('vault', `shop entity + ${vault.products.length} product entities`);
  log('vault', `filterable: ${filterable.join(', ') || '—'} · selectable: ${selectable.join(', ') || 'none'}`);
  log('vault', `${withChoice} product(s) gate Add to Cart on a choice · ${assumed} carry assumed values`);
  done('vault', `${vault.products.length} products · ${filterable.length} facets · ${selectable.length ? selectable.join('/') + ' selectable' : 'no selectable'}`, { products: vault.products.length, filterable, selectable, withChoice, assumed });

  // 4. Compose via Kiwanda web mode.
  await start('compose', 'Composing atoms → molecules → sections → templates');
  const site = composeSite({ shop: vault.shop, products: vault.products });
  log('compose', `sections: header, footer, hero(${vault.shop.hero.variant}), featured strip, product grid, filter control (${site.facets.map((f) => f.key).join(', ')}), product detail, cart overlay`);
  log('compose', `templates: home, shop, product · ${site.pages.length} pages`);
  done('compose', `${site.facets.length} facets, ${site.pages.length} pages`, { facets: site.facets });

  // 5. Write pages + assets.
  await start('pages', 'Writing static site');
  fs.rmSync(siteDir, { recursive: true, force: true });
  for (const page of site.pages) {
    write(path.join(siteDir, page.path), page.html);
    if (pace && page.kind === 'product') { log('pages', `wrote ${page.path}`); await new Promise((r) => setTimeout(r, Math.max(8, pace / 12))); }
    else log('pages', `wrote ${page.path}`);
  }
  fs.mkdirSync(path.join(siteDir, 'images'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'sources', demo, 'images'))) fs.copyFileSync(path.join(ROOT, 'sources', demo, 'images', f), path.join(siteDir, 'images', f));
  fs.mkdirSync(path.join(siteDir, 'assets'), { recursive: true });
  for (const f of ['kiwanda.css', 'kiwanda.js']) fs.copyFileSync(path.join(ROOT, 'kiwanda', 'runtime', f), path.join(siteDir, 'assets', f));
  const bytes = site.pages.reduce((n, p) => n + Buffer.byteLength(p.html), 0);
  done('pages', `${site.pages.length} pages · ${(bytes / 1024).toFixed(0)} KB HTML`, { pages: site.pages.map((p) => ({ path: p.path, kind: p.kind })) });

  // Findings + manifest.
  const findingsMd = `# ${vault.shop.name} — migration findings\n\n${findings.map((f) => `- **${f.severity}** (${f.from}) — ${f.text}`).join('\n')}\n`;
  write(path.join(out, 'findings.md'), findingsMd);
  const manifest = {
    demo, name: vault.shop.name, vertical: VERTICALS[demo], generatedAt: new Date().toISOString(), stageTimes,
    counts: { products: vault.products.length, pages: site.pages.length, facets: site.facets.length, withChoice, assumed },
    filterable, selectable, facets: site.facets, findings,
    theme: vault.shop.theme, pages: site.pages.map((p) => ({ path: p.path, kind: p.kind, slug: p.slug, title: p.slug ? vault.products.find((x) => x.slug === p.slug).name : p.kind })),
  };
  write(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  onEvent({ type: 'complete', demo, manifest });
  return manifest;
}
