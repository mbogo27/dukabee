// Snapshot the existing Taskbee demo data into sources/<demo>/ so Duka Bee is self-contained.
// Reads the photo-verified catalogs (catalog.ts / demoCatalogs.ts), store copy, and the raw scrape
// JSON (kept as attribute evidence), and copies only the images the catalogs actually reference.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASKBEE = process.env.TASKBEE_DIR || 'C:/Users/mbogo/OneDrive/Documents/Projects/july/taskbee';
const CLIENT = path.join(TASKBEE, 'client');

const read = (p) => fs.readFileSync(path.join(TASKBEE, p), 'utf8');
const slugify = (v) => v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (v) => v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');

// Pull an array/object literal assigned to `marker` out of a TS file and evaluate it as plain JS.
function extractLiteral(source, marker, scope = {}) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const open = source.indexOf('[', start + marker.length - 1);
  let depth = 0, inStr = null, i = open;
  for (; i < source.length; i++) {
    const c = source[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '[') depth++;
    if (c === ']' && --depth === 0) break;
  }
  const body = source.slice(open, i + 1);
  return new Function(...Object.keys(scope), `return ${body};`)(...Object.values(scope));
}

const parsePrice = (v) => typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, '')) || 0;

function matchRaw(rawList, name) {
  const key = norm(name).slice(0, 28);
  return rawList.find((r) => norm(r.name).startsWith(key)) || rawList.find((r) => norm(r.name).slice(0, 20) === key.slice(0, 20));
}

function snapshot(demo, { products, store, raw }) {
  const outDir = path.join(ROOT, 'sources', demo);
  const imgDir = path.join(outDir, 'images');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(imgDir, { recursive: true });
  const missingRaw = [];
  const items = products.map((p) => {
    const file = path.basename(p.image);
    fs.copyFileSync(path.join(CLIENT, 'public', p.image), path.join(imgDir, file));
    const rawMatch = matchRaw(raw, p.name);
    if (!rawMatch) missingRaw.push(p.name);
    return {
      slug: slugify(p.name),
      name: p.name,
      price: parsePrice(p.price),
      category: p.category,
      image: `images/${file}`,
      description: p.description,
      rawDescription: rawMatch ? (rawMatch.description || rawMatch.copy || '') : null,
      rawCategory: rawMatch ? rawMatch.category : null,
    };
  });
  const source = { demo, importedFrom: TASKBEE.replace(/\\/g, '/'), importedAt: new Date().toISOString(), store, products: items, missingRaw };
  fs.writeFileSync(path.join(outDir, 'source.json'), JSON.stringify(source, null, 2));
  console.log(`  ${demo}: ${items.length} products, ${fs.readdirSync(imgDir).length} images${missingRaw.length ? `, ${missingRaw.length} without raw match` : ''}`);
}

console.log(`Importing Taskbee demo data from ${TASKBEE}`);

// Kladi — only the second ("kladi") collection has verified local photography; the Luku collection
// reuses generated placeholder photos across different products, so it is excluded (logged as a finding).
const catalogTs = read('client/src/lib/commerce/catalog.ts');
const kladiProducts = extractLiteral(catalogTs, 'const kladiSourceProducts: LukuSourceProduct[] = [');
const lukuCount = extractLiteral(catalogTs, 'const lukuSourceProducts: LukuSourceProduct[] = [').length;
const kladiPage = read('client/src/pages/demos/kladi.astro');
const pick = (re) => (kladiPage.match(re) || [])[1]?.replace(/&[a-z]+;/g, '').trim();
snapshot('kladi', {
  products: kladiProducts,
  raw: JSON.parse(read('data/kladi/clothing_catalog.json')),
  store: {
    name: 'Kladi',
    wordmark: 'KLADI',
    descriptor: 'Everyday menswear',
    eyebrow: pick(/atelier-kicker">([^<]+)</) || 'Menswear edit',
    heroTitle: pick(/<h1>([^<]+)<\/h1>/),
    heroDescription: pick(/<\/h1><p>([^<]+)<\/p>/),
    footerCopy: 'Everyday menswear, priced for real life. Orders handled on WhatsApp by a real person.',
    whatsapp: extractLiteral(catalogTs.replace(/export const LUKU_WHATSAPP = '(\d+)'/, "const __wa = ['$1']"), 'const __wa = [')[0],
    excludedLukuProducts: lukuCount,
    styleNote: 'Cream and restrained dark blue (luku.css / atelier.css).',
  },
});

// Rembo + Jikoni — store copy and verified product lists from demoCatalogs.ts.
const demoTs = read('client/src/lib/commerce/demoCatalogs.ts');
const stores = extractLiteral(demoTs, 'export const demoStores: DemoStore[] = [', { remboProducts: null, jikoniProducts: null });
const storeMeta = (slug) => {
  const { products, heroImage, heroImages, heroFallback, ...rest } = stores.find((s) => s.slug === slug);
  return { ...rest, heroImages: heroImages.map((p) => `images/${path.basename(p)}`) };
};
snapshot('rembo', {
  products: extractLiteral(demoTs, 'const remboSource: SourceProduct[] = ['),
  raw: JSON.parse(read('data/rembo/catalog.json')),
  store: { ...storeMeta('rembo'), styleNote: 'Soft rose, cream and muted burgundy; Cormorant Garamond display (demo-stores.css).' },
});
snapshot('jikoni', {
  products: extractLiteral(demoTs, 'const jikoniSource: SourceProduct[] = ['),
  raw: JSON.parse(read('data/jikoni/catalog_v5.json')),
  store: { ...storeMeta('jikoni'), styleNote: 'Olive, warm cream and terracotta; Space Grotesk display (demo-stores.css).' },
});

console.log('Done. Snapshot written to sources/.');
