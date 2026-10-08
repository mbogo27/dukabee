// Spec §3 + §10.2: facet counts, filter combinations, search and URL state, on the same catalog engine the browser runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as C from '../../kiwanda/v2/catalog.mjs';
import { readJson, DATA } from './helpers.mjs';

const cfg = readJson(path.join(DATA, 'store.json'));
const models = new Map(readJson(path.join(DATA, 'models.json')).models.map((m) => [m.modelId, m]));
const products = readJson(path.join(DATA, 'products.json')).products;
const index = products.map((p) => C.indexEntry(p, models.get(p.modelId), cfg.attributes));
const keys = cfg.attributes.map((a) => a.key);
const ctx = { termsOf: (p) => p.terms, buckets: cfg.priceBuckets };
const run = (qs) => C.results(index, C.parseQuery(qs, keys), ctx);

test('§10.2 filter combinations (markup 0)', () => {
  assert.equal(run('brand=Lenovo&touch=Yes').length, 10);
  assert.equal(run('price=25000-35000').length, 20);
  assert.equal(run('ram=16GB').length, 13);
  assert.equal(run('category=2-in-1&features=Stylus pen').length, 7);
  assert.equal(run('brand=HP,Dell&cpu=Intel Core i7').length, 14);
  assert.equal(run('windows11=Yes').length, 42);
});

test('§10.2 search: "840 g6" finds the four 840 G6 configurations; "tp yoga" finds the ThinkPad Yogas', () => {
  assert.deepEqual(run('q=840 g6').map((p) => p.modelId), Array(4).fill('hp-elitebook-840-g6'));
  const yogas = run('q=tp yoga');
  assert.equal(yogas.length, 9);
  assert.ok(yogas.every((p) => p.name.startsWith('Lenovo ThinkPad') && /Yoga/.test(p.name)));
  assert.equal(run('q=core i5').length, run('q=i5').length, '"core i5" and "i5" are equivalent');
  assert.equal(run('q=x390').length, 2);
  assert.equal(run('q=t490').length, 1);
  assert.equal(run('q=elite book 840').length, run('q=eb 840').length);
});

test('§3.2 facet counts match the spec table', () => {
  const facets = C.buildFacets(index, cfg.attributes, cfg.priceBuckets);
  const c = C.facetCounts(index, C.emptyQuery(), facets, ctx);
  assert.deepEqual(c.price, { '0-25000': 8, '25000-35000': 20, '35000-45000': 22, '45000-60000': 11, '60000-': 3 });
  assert.deepEqual(c.brand, { HP: 39, Lenovo: 16, Apple: 5, Dell: 4 });
  assert.deepEqual(c.cpu, { 'Intel Core i5': 32, 'Intel Core i7': 19, 'AMD Ryzen 5': 6, 'AMD Ryzen 7': 3, 'Intel Core m5': 2, 'Intel Core i3': 1, 'Intel Celeron': 1 });
  assert.deepEqual(c.cpuGen, { '11th Gen': 4, '10th Gen': 10, '8th Gen': 23, '7th Gen': 5, '6th Gen': 6, '4th Gen': 2, '3rd Gen': 1 });
  assert.deepEqual(c.ram, { '4GB': 2, '8GB': 48, '16GB': 13, '32GB': 1 });
  assert.deepEqual(c.storage, { '128GB': 3, '192GB': 1, '256GB': 47, '500GB': 2, '512GB': 11 });
  assert.deepEqual(c.screen, { '11.6"': 3, '12"': 2, '12.5"': 4, '13.3"': 23, '14"': 29, '15.6"': 1 });
  assert.deepEqual(c.touch, { Yes: 31, No: 33 });
  assert.deepEqual(c.formFactor, { Clamshell: 47, Convertible: 13, Detachable: 2, 'Mini PC': 2 });
  assert.deepEqual(c.graphics, { Integrated: 56, Dedicated: 8 });
  assert.deepEqual(c.windows11, { Yes: 42, No: 12, Check: 5, macOS: 5 });
  assert.deepEqual(c.features, { 'Stylus pen': 7, 'Touch Bar': 2, 'Extra 1TB HDD': 1 });
  assert.deepEqual(c.category, { 'business-laptops': 40, '2-in-1': 15, macbooks: 5, workstations: 2, 'mini-pcs': 2 });
  assert.deepEqual(facets.map((f) => f.key), ['price', 'brand', 'series', 'cpu', 'cpuGen', 'ram', 'storage', 'screen', 'touch', 'formFactor', 'graphics', 'windows11', 'features'], 'AttributeDef.order, price first');
  assert.deepEqual(facets.find((f) => f.key === 'brand').values.map((v) => v.value), ['HP', 'Lenovo', 'Dell', 'Apple'], 'schema display order');
});

test('faceted counts exclude their own facet; facets with <2 values in the category hide', () => {
  const facets = C.buildFacets(index, cfg.attributes, cfg.priceBuckets);
  const q = C.parseQuery('brand=Lenovo', keys);
  const c = C.facetCounts(index, q, facets, ctx);
  assert.deepEqual(c.brand, { HP: 39, Lenovo: 16, Apple: 5, Dell: 4 }, 'brand counts ignore the brand filter');
  assert.equal(Object.values(c.ram).reduce((a, b) => a + b, 0), 16, 'other facets respect it');
  const mini = C.visibleFacetKeys(index, C.parseQuery('category=mini-pcs', keys), facets);
  assert.ok(!mini.includes('screen'), 'Screen hides under Mini PCs');
  assert.ok(mini.includes('brand'));
});

test('URL state round-trips, multi-values comma-separated, open-ended price buckets', () => {
  const qs = 'category=2-in-1&brand=HP,Lenovo&ram=16GB&touch=Yes&price=25000-35000&q=x390&sort=price-asc';
  const q = C.parseQuery(qs, keys);
  assert.deepEqual(q.attrs, { brand: ['HP', 'Lenovo'], ram: ['16GB'], touch: ['Yes'] });
  assert.equal(C.serializeQuery(q, keys), qs);
  assert.deepEqual(C.parseRange('60000-'), { lo: 60000, hi: Infinity });
  assert.equal(run('price=60000-').length, 3);
  assert.equal(C.rangeLabel('0-30000', cfg.priceBuckets), 'Under KSh 30K');
  assert.deepEqual(C.parseQuery('brand=HP&brand=Dell', keys).attrs.brand, ['HP', 'Dell'], 'repeated params from a no-JS form also work');
});

test('empty-state WhatsApp summary reads like the spec', () => {
  const q = C.parseQuery('brand=Lenovo&ram=16GB&touch=Yes&price=25000-35000', keys);
  assert.equal(C.filterSummary(q, { defs: cfg.attributes, buckets: cfg.priceBuckets }), 'Lenovo, 16GB RAM, touchscreen, KSh 25K–35K');
});

test('sort: recommended = featured first then price; out-of-stock last and only when filtering', () => {
  const rec = run('');
  assert.ok(rec.slice(0, 6).every((p) => p.featured));
  const withOut = index.map((p) => (p.slug === 'lenovo-thinkpad-x260-i5-8gb-256gb' ? { ...p, stock: 'out' } : p));
  assert.equal(C.results(withOut, C.emptyQuery(), ctx).length, 63, 'hidden from the default listing');
  const filtered = C.results(withOut, C.parseQuery('brand=Lenovo&sort=price-asc', keys), ctx);
  assert.equal(filtered.at(-1).slug, 'lenovo-thinkpad-x260-i5-8gb-256gb', 'sorts last when a filter includes it');
  assert.equal(C.publicProduct(products[0]).cost, undefined);
});
