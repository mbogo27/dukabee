// Rebuilds a stand-in for Francis's stock sheet from the spec's seed catalog, for the importer snapshot test.
//
// The original laptop_stock_no_markup.xlsx was not in the repo when the importer was built, so this writes a
// RECONSTRUCTED sheet: the same 68 rows, row numbers, Brand | Model aliases and costs (including the lower price
// of each duplicate pair, from spec §12), with Specifications text written in the sheet's style
// ("i5 8th Gen, 8GB/256GB, Touchscreen"). Facts the seed marks as inferred are left out of the text, which is
// what makes them inferred. When the real sheet is available, drop it in data/dobatron/source/ and the snapshot
// test runs against it instead.
//
//   node tests/fixtures/dobatron/make-fixture.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeXlsx } from '../../../scripts/lib/xlsx.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '../../../data/dobatron');
// The spec's companion catalog is the expected importer output, so it is also the source for the stand-in sheet.
const seed = JSON.parse(fs.readFileSync(path.join(HERE, 'dobatron-catalog.json'), 'utf8')).products;
const models = new Map(JSON.parse(fs.readFileSync(path.join(DATA, 'models.json'), 'utf8')).models.map((m) => [m.modelId, m]));

// The other half of each duplicate pair (spec §12 item 2): row → the lower cost.
const DUPLICATE_LOW = { 6: 35748.7, 11: 30550, 10: 33798.7, 26: 53298.7 };
// A little variety in how the sheet words things, so the parser is exercised on every form it accepts.
const TOUCH_WORDS = ['Touchscreen', 'Touch', 'Glass Touchscreen'];
const GPU_WORDS = { 'hp-zbook-firefly-14-g8': 'Nvidia Graphics', 'hp-probook-645-g4': 'Dedicated Graphics' };

const rows = [['Brand', 'Model', 'Specifications', 'Price (KES)']];
const out = [];
for (const p of seed) {
  const m = models.get(p.modelId);
  const a = p.attributes;
  for (const row of p.sourceRows) {
    const flagged = Object.entries(m.aliasFlags || {}).find(([, f]) => f.inferred.every((k) => p.inferred.includes(k)))?.[0];
    const plain = m.sheetAliases.filter((s) => !(m.aliasFlags || {})[s]);
    const alias = flagged || (p.modelId === 'lenovo-thinkpad-x390-yoga' && row === 62 ? 'Lenovo | Yoga X390 x360' : plain[0]);
    const [brand, model] = alias.split(' | ');
    const label = p.name.split(' · ')[1].split(',')[0];
    const cpu = a.cpu[0].startsWith('AMD') ? label
      : a.cpu[0] === 'Intel Celeron' ? 'Intel Celeron'
        : a.cpu[0].replace('Intel Core ', '').replace('m5', 'M5') + (a.cpuGen && !p.inferred.includes('cpuGen') ? ` ${a.cpuGen[0]}` : '');
    const parts = [cpu, `${a.ram[0]}/${a.storage[0]}${(a.features || []).includes('Extra 1TB HDD') ? ' + 1TB HDD' : ''}`];
    if (a.gpuMemory) parts.push(`${a.gpuMemory[0]} ${GPU_WORDS[p.modelId] || 'Graphics'}`);
    if (a.formFactor[0] === 'Clamshell' && !p.inferred.includes('touch')) parts.push(a.touch[0] === 'Yes' ? TOUCH_WORDS[row % 3] : 'Non-Touch');
    if (a.formFactor[0] === 'Convertible' && row % 4 === 0) parts.push('Touch');
    if ((a.features || []).includes('Stylus pen')) parts.push('incl. Stylus Pen');
    if ((a.features || []).includes('Touch Bar') && row !== 26) parts.push('Touch Bar');
    out.push({ row, cells: [brand, model, parts.join(', '), DUPLICATE_LOW[row] ?? p.cost] });
  }
}
out.sort((x, y) => x.row - y.row);
for (const r of out) { rows[r.row - 1] = r.cells; }
if (rows.length !== 69 || rows.some((r) => !r)) throw new Error(`expected rows 1..69 filled, got ${rows.length}`);
const file = path.join(HERE, 'laptop_stock_2026-10-08.reconstructed.xlsx');
fs.writeFileSync(file, writeXlsx(rows, { sheet: 'Stock List' }));
console.log(`wrote ${path.relative(process.cwd(), file)} (${rows.length - 1} rows)`);
