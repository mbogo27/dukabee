// composeHomepage (v2 Phase 3) unit tests on the product-tree homepage (Site Structure Spec).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { composeHomepage, RECIPES } from '../../kiwanda/v2/compose.mjs';
import { buildTree } from '../../kiwanda/v2/tree.mjs';
import { publicProduct, serializeQuery } from '../../kiwanda/v2/catalog.mjs';
import { readJson, DATA } from './helpers.mjs';

const cfg = readJson(path.join(DATA, 'store.json'));
const taxonomy = readJson(path.join(DATA, 'taxonomy.json'));
const models = readJson(path.join(DATA, 'models.json')).models;
// Offers annotated by the tree (category, series, model URL), as the storefront build does.
const freshProducts = () => {
  const ps = readJson(path.join(DATA, 'products.json')).products.map(publicProduct);
  const tree = buildTree({ taxonomy, models, products: ps });
  return { ps, tree };
};
const { ps: products, tree } = freshProducts();
const guides = [{ slug: 'g', title: 'Guide', publishedAt: '2026-10-08', tagsTargeted: [] }];
const listingHref = (q, keys) => { const rest = serializeQuery({ ...q, category: null }, keys); return `/${q.category || 'laptops'}${rest ? `?${rest}` : ''}`; };
const series = [...tree.categories.get('laptops').series].map((s) => ({ id: s.slug, name: s.name, href: s.path }));
const catalog = (over = {}) => ({ products, categories: [], series, banners: cfg.banners, attributes: cfg.attributes, priceBuckets: cfg.priceBuckets, guides, tiers: cfg.homepage.tiers, now: '2026-10-10T12:00:00+03:00', listingHref, seriesHref: (id) => tree.series.get(id)?.path, ...over });
const store = (over = {}) => ({ ...cfg.store, sections: cfg.homepage.sections, ...over });
const types = (secs) => secs.map((s) => `${s.type}:${s.variant}`);

test('Dobatron: the 12 configured sections render in order, with the trust strip (3 confirmed policies)', () => {
  const report = {};
  const secs = composeHomepage(store(), catalog(), report);
  assert.equal(report.tier, 'full');
  assert.deepEqual(types(secs), [
    'announcement:static', 'hero:split', 'categoryNav:circles', 'productRail:tabs', 'promoBanner:twoUp', 'productShowcase:left',
    'productRail:carousel', 'promoBanner:threeUp', 'productRail:grid', 'guideTeaser:list', 'trustStrip:icons', 'footer:standard',
  ]);
  assert.deepEqual(report.dropped, []);
});

test('trust strip drops with fewer than 2 confirmed policies', () => {
  const report = {};
  const secs = composeHomepage(store({ policies: ['M-Pesa accepted'] }), catalog(), report);
  assert.ok(!secs.some((s) => s.type === 'trustStrip'));
  assert.deepEqual(report.dropped.map((d) => d.type), ['trustStrip']);
});

test('banner tokens and links follow the product tree: /laptops filters, series pages, the quiz', () => {
  const secs = composeHomepage(store(), catalog());
  const hero = secs.find((s) => s.type === 'hero');
  assert.equal(hero.data.main.href, '/laptops');
  assert.equal(hero.data.tiles[0].sub, '15 picks for students and first jobs', 'laptops only: mini PCs are their own category');
  assert.equal(hero.data.tiles[0].href, '/laptops?price=0-30000');
  assert.equal(hero.data.tiles[1].href, '/find-my-laptop');
  const promos = secs.filter((s) => s.type === 'promoBanner');
  assert.deepEqual(promos[0].data.banners.map((b) => [b.headline, b.href]), [['MacBooks from KSh 25,000', '/laptops/apple-macbook-pro'], ['Need graphics power?', '/laptops?graphics=Dedicated']]);
  assert.deepEqual(promos[1].data.banners.map((b) => [b.sub, b.href]), [
    ['15 available, from KSh 18,500', '/laptops/lenovo-thinkpad'], ['29 available, from KSh 30,000', '/laptops/hp-elitebook'], ['4 available, from KSh 23,000', '/laptops/dell-latitude'],
  ]);
  const tabs = secs.find((s) => s.variant === 'tabs').data.tabs;
  assert.deepEqual(tabs.map((t) => [t.label, t.all.length, t.products.length, t.href]), [
    ['Under 30K', 15, 8, '/laptops?price=0-30000&sort=price-asc'], ['16GB RAM+', 14, 8, '/laptops?ram=16GB,32GB&sort=price-asc'],
    ['Touchscreen', 31, 8, '/laptops?touch=Yes&sort=price-asc'], ['Windows 11 ready', 42, 8, '/laptops?windows11=Yes&sort=price-asc'],
  ]);
  assert.ok(tabs[0].products.every((p, i, a) => i === 0 || a[i - 1].price <= p.price), 'price ascending');
  assert.ok(tabs.flatMap((t) => t.products).every((p) => p.href.startsWith('/laptops/') && p.href.includes('?variant=')), 'cards link to model pages');
  const nav = secs.find((s) => s.type === 'categoryNav').data.categories;
  assert.deepEqual(nav.map((c) => c.href), ['/laptops/hp-elitebook', '/laptops/hp-probook', '/laptops/hp-zbook', '/laptops/hp-elite-x2', '/laptops/lenovo-thinkpad', '/laptops/dell-latitude', '/laptops/apple-macbook-pro']);
  assert.doesNotMatch(JSON.stringify(secs.map((s) => s.data)), /\{(count|fromPrice)\}/);
});

test('no product appears in more than 2 sections', () => {
  const secs = composeHomepage(store(), catalog());
  const seen = new Map();
  for (const s of secs) {
    const list = s.data.tabs ? s.data.tabs.flatMap((t) => t.products) : s.data.products || [];
    for (const slug of new Set(list.map((p) => p.slug))) seen.set(slug, (seen.get(slug) || 0) + 1);
  }
  assert.ok([...seen.values()].every((n) => n <= 2), JSON.stringify([...seen].filter(([, n]) => n > 2)));
});

test('filter target with <3 matches is dropped (banner, and the section needing it)', () => {
  const banners = cfg.banners.map((b) => (b.id === 'promo-graphics' ? { ...b, target: { type: 'filter', query: { category: 'laptops', ram: '32GB' } } } : b));
  const report = {};
  const secs = composeHomepage(store(), catalog({ banners }), report);
  assert.ok(!secs.some((s) => s.variant === 'twoUp'));
  assert.ok(report.dropped.some((d) => d.variant === 'twoUp'));
});

test('series target with <3 available offers is dropped', () => {
  const banners = cfg.banners.map((b) => (b.id === 'promo-latitude' ? { ...b, target: { type: 'series', id: 'hp-elite-x2' } } : b));
  const report = {};
  composeHomepage(store(), catalog({ banners }), report);
  assert.ok(report.dropped.some((d) => d.variant === 'threeUp'), 'Elite x2 has only 2 offers');
});

test('tab with <4 products is dropped; one tab left becomes a grid', () => {
  const sections = cfg.homepage.sections.map((s) => (s.variant === 'tabs' ? { ...s, source: { tabs: [s.source.tabs[0], { label: 'Workstations', source: { filter: { category: 'laptops', series: 'ZBook' } } }] } } : s));
  const report = {};
  const secs = composeHomepage(store({ sections }), catalog(), report);
  const rail = secs[3];
  assert.equal(rail.type, 'productRail');
  assert.equal(rail.variant, 'grid', 'fewer than 2 tabs → grid');
  assert.ok(report.dropped.some((d) => d.type === 'tab' && d.title === 'Workstations'));
});

test('adjacent rails are separated by moving the next banner/showcase between them', () => {
  const s = cfg.homepage.sections;
  const order = [s[0], s[1], s[3], s[6], s[4], s[11]]; // tabs rail then carousel rail, then a promo
  const secs = composeHomepage(store({ sections: order }), catalog());
  for (let i = 1; i < secs.length; i++) assert.ok(!(secs[i].type === 'productRail' && secs[i - 1].type === 'productRail'), types(secs).join(' > '));
  assert.deepEqual(types(secs).slice(2, 5), ['productRail:tabs', 'promoBanner:twoUp', 'productRail:carousel']);
});

test('hero dropped → showcase promoted to a spotlight hero, first after the announcement', () => {
  const sections = cfg.homepage.sections.map((x) => (x.type === 'hero' ? { ...x, bannerIds: ['hero-main', 'missing'] } : x));
  const secs = composeHomepage(store({ sections }), catalog());
  assert.deepEqual(types(secs).slice(0, 2), ['announcement:static', 'hero:spotlight']);
  assert.equal(secs[1].data.product.slug, 'hp-zbook-firefly-14-g8-i7-32gb-512gb');
});

test('recipes: every tier × recipe composes, with hero first and footer last', () => {
  const sizes = { starter: 6, growing: 20, full: 64 };
  for (const recipe of Object.keys(RECIPES)) for (const [tier, n] of Object.entries(sizes)) {
    const report = {};
    const secs = composeHomepage(store({ sections: undefined, recipe, policies: ['Delivery in Nairobi', 'M-Pesa accepted'] }), catalog({ products: products.slice(0, n) }), report);
    assert.equal(report.tier, tier, `${recipe}/${tier}`);
    assert.equal(secs.find((s) => s.type !== 'announcement').type, 'hero', `${recipe}/${tier}: ${types(secs)}`);
    assert.equal(secs.at(-1).type, 'footer');
    assert.ok(secs.some((s) => s.type === 'productRail'), `${recipe}/${tier} has a product rail`);
    if (tier === 'starter') assert.deepEqual(report.warnings, [], `${recipe}/starter renders the minimum set`);
  }
});

test('no offers → offer countdown hidden', () => {
  const report = {};
  composeHomepage(store({ sections: undefined, recipe: 'marketplace' }), catalog(), report);
  assert.ok(report.dropped.some((d) => d.type === 'offerCountdown'));
});
