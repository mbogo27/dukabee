// Dobatron stock-sheet importer (spec §2.3). Repeatable: run it on every sheet Francis sends.
//
//   node scripts/dobatron-import.mjs data/dobatron/source/laptop_stock_2026-10-08.xlsx
//   node scripts/dobatron-import.mjs <sheet.xlsx> --date 2026-10-08 --dry-run
//
// Reads  data/dobatron/models.json (registry + sheet aliases), data/dobatron/store.json (pricing, condition)
//        and the previous data/dobatron/products.json (curation + stock lifecycle).
// Writes data/dobatron/products.json (PRIVATE: includes cost) and reports/dobatron-import-YYYY-MM-DD.md.
// Fails (exit 1, nothing written) on unmapped models, unreadable spec cells, bad prices or slug collisions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readXlsx } from './lib/xlsx.mjs';
import { readSheetTable, aliasIndex, priceFromCost, applyStockLifecycle, ksh } from '../pipeline/supplier-import.mjs';
import { parseLaptopSpecs, laptopMergeKey, mergeLaptopSpecs, buildLaptopProduct, priceInversions } from '../pipeline/verticals/laptops.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLUMNS = ['Brand', 'Model', 'Specifications', 'Price (KES)'];

export class ImportError extends Error {
  constructor(message, problems) { super(`${message}\n${problems.map((p) => `  - ${p}`).join('\n')}`); this.problems = problems; }
}

/**
 * Pure import: sheet rows + registry + previous products → next products and the report data.
 * @param {{ rows: {row:number,cells:any[]}[], models: object[], store: object, previous: object[], date: string, source: string }} input
 */
export function importStock({ rows, models, store, previous = [], date, source }) {
  const table = readSheetTable(rows, COLUMNS);
  const lookup = aliasIndex(models);
  const pricing = store.pricing;
  const condition = store.store.condition || 'Ex-UK';

  const unmapped = [], unreadable = [];
  const groups = new Map();
  for (const r of table) {
    const { key, model } = lookup(r.Brand, r.Model);
    if (!model) { unmapped.push(`Row ${r.row}: "${key}" is not in models.json sheetAliases`); continue; }
    const cost = typeof r['Price (KES)'] === 'number' ? r['Price (KES)'] : Number(String(r['Price (KES)'] ?? '').replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(cost) || cost <= 0) { unreadable.push(`Row ${r.row}: price "${r['Price (KES)']}" is not a number`); continue; }
    const parsed = parseLaptopSpecs(r.Specifications, model, { brand: String(r.Brand).trim() });
    if (parsed.error) { unreadable.push(`Row ${r.row} (${key}): ${parsed.error}`); continue; }
    const extraInferred = model.aliasFlags?.[key]?.inferred || [];
    const mk = laptopMergeKey(model.modelId, parsed);
    const entry = { row: r.row, cost, parsed, extraInferred, model, specs: r.Specifications };
    if (!groups.has(mk)) groups.set(mk, []);
    groups.get(mk).push(entry);
  }
  if (unmapped.length) throw new ImportError(`${unmapped.length} row(s) use a model that isn't mapped. Add the alias (or a new model) to data/dobatron/models.json and re-run:`, unmapped);
  if (unreadable.length) throw new ImportError(`${unreadable.length} row(s) couldn't be read:`, unreadable);

  const merged = [];
  const fresh = [];
  const prevBySlug = new Map(previous.map((p) => [p.slug, p]));
  for (const entries of groups.values()) {
    // Duplicates (two lists pasted into one sheet): keep one product at the HIGHER price until confirmed.
    const ranked = entries.slice().sort((a, b) => b.cost - a.cost || a.row - b.row);
    const parsed = ranked.slice(1).reduce((acc, e) => mergeLaptopSpecs(acc, e.parsed), ranked[0].parsed);
    const extraInferred = entries.length > 1 ? ranked[0].extraInferred.filter((k) => entries.every((e) => e.extraInferred.includes(k))) : ranked[0].extraInferred;
    const base = buildLaptopProduct(parsed, ranked[0].model, { condition, extraInferred });
    const cost = ranked[0].cost;
    const sourceRows = entries.map((e) => e.row).sort((a, b) => a - b);
    if (entries.length > 1) merged.push({ slug: base.slug, name: base.name, rows: entries.map((e) => ({ row: e.row, cost: e.cost })).sort((a, b) => a.row - b.row), kept: cost });
    const prev = prevBySlug.get(base.slug);
    const product = {
      id: base.id, slug: base.slug, modelId: base.modelId, name: base.name,
      price: priceFromCost(cost, pricing), cost,
      categoryId: base.categoryId, images: base.images,
      description: prev?.customDescription ? prev.description : base.description,
      ...(prev?.customDescription ? { customDescription: true } : {}),
      attributes: base.attributes, inferred: base.inferred,
      featured: prev?.featured ?? false, bestseller: prev?.bestseller ?? false,
      createdAt: prev?.createdAt ?? `${date}T00:00:00+03:00`,
      stock: 'in', sourceRows,
    };
    fresh.push(product);
  }

  const seen = new Map();
  const collisions = [];
  for (const p of fresh) {
    if (seen.has(p.slug)) collisions.push(`"${p.slug}" from rows ${seen.get(p.slug).sourceRows.join(', ')} and rows ${p.sourceRows.join(', ')}`);
    seen.set(p.slug, p);
  }
  if (collisions.length) throw new ImportError('Slug collision (two different configurations produce the same URL). Fix the sheet or the registry:', collisions);

  fresh.sort((a, b) => a.sourceRows[0] - b.sourceRows[0]);
  const life = applyStockLifecycle(fresh, previous);
  const products = life.products;
  const inferredCount = fresh.reduce((n, p) => n + p.inferred.length, 0);
  const inferredBy = fresh.reduce((acc, p) => { for (const k of p.inferred) acc[k] = (acc[k] || 0) + 1; return acc; }, {});

  return {
    products,
    report: {
      date, source, rowsRead: table.length, productsWritten: products.length, inStock: fresh.length,
      merged, unmapped, newlyOut: life.newlyOut, backIn: life.backIn, added: previous.length ? life.added : [],
      priceChanges: life.priceChanges, inferredCount, inferredBy, inversions: priceInversions(products), pricing,
    },
  };
}

export function renderReport(r) {
  const lines = [
    `# Dobatron import, ${r.date}`, '',
    `Source: \`${r.source}\`  `,
    `Pricing: markup ${r.pricing.markupPct}%, rounded up to KSh ${r.pricing.roundUpTo}`, '',
    '| | |', '|---|---:|',
    `| Rows read | ${r.rowsRead} |`,
    `| Products written | ${r.productsWritten} |`,
    `| In stock (in this sheet) | ${r.inStock} |`,
    `| Merged duplicates | ${r.merged.length} |`,
    `| Unmapped models | ${r.unmapped.length} |`,
    `| Price changes since last import | ${r.priceChanges.length} |`,
    `| Newly out of stock | ${r.newlyOut.length} |`,
    `| Back in stock | ${r.backIn.length} |`,
    `| Inferred fields | ${r.inferredCount} (${Object.entries(r.inferredBy).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}) |`,
    `| Price inversions | ${r.inversions.length} |`, '',
  ];
  const section = (title, items, fmt, none = 'None.') => lines.push(`## ${title}`, '', ...(items.length ? items.map(fmt) : [none]), '');
  section('Merged duplicates (kept at the higher price until confirmed)', r.merged,
    (m) => `- **${m.name}** (\`${m.slug}\`): ${m.rows.map((x) => `row ${x.row} ${ksh(x.cost)}`).join(' vs ')} → kept ${ksh(m.kept)}`);
  section('Price inversions (a better configuration is cheaper; looks like an error to buyers)', r.inversions,
    (i) => `- **${i.better.name}** at ${ksh(i.better.price)} is cheaper than **${i.worse.name}** at ${ksh(i.worse.price)} (rows ${i.better.sourceRows.join(', ')} vs ${i.worse.sourceRows.join(', ')})`);
  section('Price changes since last import', r.priceChanges, (c) => `- ${c.name}: ${ksh(c.from)} → ${ksh(c.to)}`);
  section('Newly out of stock (pages stay live with "Request this laptop")', r.newlyOut, (p) => `- ${p.name} (\`/p/${p.slug}\`)`);
  section('Back in stock', r.backIn, (p) => `- ${p.name}`);
  if (r.added.length) section('New products', r.added, (p) => `- ${p.name} (${ksh(p.price)})`);
  section('Unmapped models', r.unmapped, (u) => `- ${u}`);
  return lines.join('\n');
}

export const loadJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

export function runImportFile(sheetPath, { dataDir = path.join(ROOT, 'data/dobatron'), reportsDir = path.join(ROOT, 'reports'), date, dryRun = false, sheet, previous } = {}) {
  const fileDate = path.basename(sheetPath).match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const runDate = date || fileDate || new Date().toISOString().slice(0, 10);
  const { rows } = readXlsx(fs.readFileSync(sheetPath), { sheet });
  const models = loadJson(path.join(dataDir, 'models.json')).models;
  const store = loadJson(path.join(dataDir, 'store.json'));
  const productsFile = path.join(dataDir, 'products.json');
  const prev = previous ?? (fs.existsSync(productsFile) ? loadJson(productsFile).products : []);
  const result = importStock({ rows, models, store, previous: prev, date: runDate, source: path.basename(sheetPath) });
  if (!dryRun) {
    fs.writeFileSync(productsFile, JSON.stringify({
      _note: 'GENERATED by scripts/dobatron-import.mjs. Contains private cost: never copy to public output.',
      generatedAt: runDate, source: path.basename(sheetPath), pricing: store.pricing, products: result.products,
    }, null, 2) + '\n');
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(path.join(reportsDir, `dobatron-import-${runDate}.md`), renderReport(result.report) + '\n');
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const dryRun = args.includes('--dry-run'); if (dryRun) args.splice(args.indexOf('--dry-run'), 1);
  const date = flag('date'), sheet = flag('sheet');
  const file = args[0];
  if (!file) { console.error('Usage: node scripts/dobatron-import.mjs <sheet.xlsx> [--date YYYY-MM-DD] [--sheet "Stock List"] [--dry-run]'); process.exit(2); }
  try {
    const { report } = runImportFile(path.resolve(file), { date, dryRun, sheet });
    console.log(`✓ ${report.rowsRead} rows → ${report.productsWritten} products (${report.inStock} in stock, ${report.merged.length} merged duplicates, ${report.inversions.length} price inversions, ${report.newlyOut.length} newly out of stock)`);
    console.log(dryRun ? '  (dry run: nothing written)' : `  wrote data/dobatron/products.json and reports/dobatron-import-${report.date}.md`);
  } catch (e) {
    console.error(`✗ Import failed. ${e.message}`);
    process.exit(1);
  }
}
