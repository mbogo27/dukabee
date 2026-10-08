// Spec §10.1: the importer reproduces the seed catalog, reports duplicates and inversions, keeps removed products
// as out of stock, and fails on unmapped models.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runImportFile, importStock } from '../../scripts/dobatron-import.mjs';
import { readXlsx, writeXlsx } from '../../scripts/lib/xlsx.mjs';
import { priceFromCost } from '../../pipeline/supplier-import.mjs';
import { buildStorefront } from '../../scripts/build-storefront.mjs';
import { seed, stockSheet, tempData, tempDir, readJson, DATA } from './helpers.mjs';

const expected = seed().products;
const norm = (p, { featured = true } = {}) => {
  const { inferred, sourceRows, featured: f, ...rest } = p;
  return { ...rest, inferred: [...inferred].sort(), sourceRows: [...sourceRows].sort((a, b) => a - b), ...(featured ? { featured: f } : {}) };
};

test('import reproduces the 64 seed products exactly (re-import over the seed)', () => {
  const { products, report } = runImportFile(stockSheet(), { dryRun: true, previous: expected, date: '2026-10-08' });
  assert.equal(report.rowsRead, 68);
  assert.equal(products.length, 64);
  const got = new Map(products.map((p) => [p.slug, p]));
  for (const e of expected) assert.deepEqual(norm(got.get(e.slug)), norm(e), e.slug);
});

test('a first import (no previous products.json) gives the same catalog apart from curated flags', () => {
  const { products } = runImportFile(stockSheet(), { dryRun: true, previous: [], date: '2026-10-08' });
  const got = new Map(products.map((p) => [p.slug, p]));
  assert.deepEqual([...got.keys()].sort(), expected.map((p) => p.slug).sort());
  for (const e of expected) assert.deepEqual(norm(got.get(e.slug), { featured: false }), norm(e, { featured: false }), e.slug);
});

test('report lists the 4 merged duplicates (kept at the higher price) and the 2 price inversions', () => {
  const { report } = runImportFile(stockSheet(), { dryRun: true, previous: expected, date: '2026-10-08' });
  assert.deepEqual(report.merged.map((m) => m.rows.map((r) => r.row)).sort(), [[10, 55], [11, 54], [26, 67], [6, 47]].sort());
  assert.deepEqual(report.merged.find((m) => m.slug === 'hp-elitebook-840-g7-i5-8gb-256gb').kept, 37700);
  assert.deepEqual(report.inversions.map((i) => [i.better.slug, i.worse.slug]).sort(), [
    ['apple-macbook-pro-13-2018-i5-16gb-256gb', 'apple-macbook-pro-13-2018-i5-8gb-256gb'],
    ['hp-elitebook-745-g6-ryzen-7-16gb-256gb', 'hp-elitebook-745-g6-ryzen-7-8gb-256gb'],
  ]);
});

test('removing a row marks that product out of stock; its page still builds with the Request CTA', async () => {
  const dir = tempData();
  const { rows } = readXlsx(fs.readFileSync(stockSheet()));
  const dropped = rows.filter((r) => r.row !== 20); // ThinkPad X260
  const sheet = path.join(dir, 'source', 'laptop_stock_2026-10-15.xlsx');
  fs.mkdirSync(path.dirname(sheet), { recursive: true });
  fs.writeFileSync(sheet, writeXlsx(dropped.map((r) => r.cells), { sheet: 'Stock List' }));
  const reports = tempDir('dobatron-reports-');
  const { report } = runImportFile(sheet, { dataDir: dir, reportsDir: reports });
  assert.deepEqual(report.newlyOut.map((p) => p.slug), ['lenovo-thinkpad-x260-i5-8gb-256gb']);
  const after = readJson(path.join(dir, 'products.json')).products;
  assert.equal(after.length, 64, 'no slug is ever deleted');
  assert.equal(after.find((p) => p.slug === 'lenovo-thinkpad-x260-i5-8gb-256gb').stock, 'out');
  assert.match(fs.readFileSync(path.join(reports, 'dobatron-import-2026-10-15.md'), 'utf8'), /Newly out of stock[\s\S]*ThinkPad X260/);

  const out = tempDir();
  await buildStorefront('dobatron', { dataDir: dir, outDir: out, log: () => {} });
  const html = fs.readFileSync(path.join(out, 'p/lenovo-thinkpad-x260-i5-8gb-256gb.html'), 'utf8');
  assert.match(html, /Request this laptop/);
  assert.match(html, /Last listed at/);
  assert.match(html, /schema\.org\/OutOfStock/);
  assert.doesNotMatch(html, /data-add="lenovo-thinkpad-x260/);
  const shop = fs.readFileSync(path.join(out, 'shop.html'), 'utf8');
  assert.match(shop, /<article class="sf-card is-out" data-slug="lenovo-thinkpad-x260-i5-8gb-256gb" hidden>/, 'hidden from the default shop listing');

  // Back in the next sheet → back in stock.
  const sheet2 = path.join(dir, 'source', 'laptop_stock_2026-10-22.xlsx');
  fs.copyFileSync(stockSheet(), sheet2);
  const again = runImportFile(sheet2, { dataDir: dir, reportsDir: reports });
  assert.deepEqual(again.report.backIn.map((p) => p.slug), ['lenovo-thinkpad-x260-i5-8gb-256gb']);
});

test('an unmapped model fails the run with its row number, and nothing is written', () => {
  const { rows } = readXlsx(fs.readFileSync(stockSheet()));
  const bad = rows.map((r) => (r.row === 12 ? { ...r, cells: ['HP', '850 G5', 'i5 8th Gen, 8GB/256GB', 30000] } : r));
  const cfg = readJson(path.join(DATA, 'store.json'));
  const models = readJson(path.join(DATA, 'models.json')).models;
  assert.throws(() => importStock({ rows: bad, models, store: cfg, previous: [], date: '2026-10-08', source: 'x.xlsx' }), /Row 12: "HP \| 850 G5"/);
});

test('pricing: markup then round up to the step, without float noise', () => {
  assert.equal(priceFromCost(57198.7, { markupPct: 0, roundUpTo: 500 }), 57500);
  assert.equal(priceFromCost(58500, { markupPct: 0, roundUpTo: 500 }), 58500);
  assert.equal(priceFromCost(45000, { markupPct: 30, roundUpTo: 500 }), 58500);
  assert.equal(priceFromCost(29000, { markupPct: 30, roundUpTo: 500 }), 38000);
});
