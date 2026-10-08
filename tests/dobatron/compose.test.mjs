// composeHomepage (v2 Phase 3) unit tests, including the cases spec §10.4 calls out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { composeHomepage, RECIPES } from '../../kiwanda/v2/compose.mjs';
import { readJson, DATA } from './helpers.mjs';

const cfg = readJson(path.join(DATA, 'store.json'));
const products = readJson(path.join(DATA, 'products.json')).products;
const guides = [{ slug: 'g', title: 'Guide', publishedAt: '2026-10-08' }];
const catalog = (over = {}) => ({ products, categories: cfg.categories, banners: cfg.banners, attributes: cfg.attributes, priceBuckets: cfg.priceBuckets, guides, tiers: cfg.homepage.tiers, now: '2026-10-08T12:00:00+03:00', ...over });
const store = (over = {}) => ({ ...cfg.store, sections: cfg.homepage.sections, ...over });
const types = (secs) => secs.map((s) => `${s.type}:${s.variant}`);

test('Dobatron: the 12 configured sections render in order, trust strip dropped with <2 policies', () => {
  const report = {};
  const secs = composeHomepage(store(), catalog(), report);
  assert.equal(report.tier, 'full');
  assert.deepEqual(types(secs), [
    'announcement:static', 'hero:split', 'categoryNav:circles', 'productRail:tabs', 'promoBanner:twoUp', 'productShowcase:left',
    'productRail:carousel', 'promoBanner:threeUp', 'productRail:grid', 'guideTeaser:card', 'footer:standard',
  ]);
  assert.deepEqual(report.dropped.map((d) => d.type), ['trustStrip']);
});

test('trust strip renders once 2 policies are confirmed, right before the footer', () => {
  const secs = composeHomepage(store({ policies: ['M-Pesa accepted', 'Countrywide delivery'] }), catalog());
  assert.deepEqual(types(secs).slice(-2), ['trustStrip:icons', 'footer:standard']);
});

test('banner tokens interpolate {count} and {fromPrice}; tabs and categories carry the spec counts', () => {
  const secs = composeHomepage(store(), catalog());
  const hero = secs.find((s) => s.type === 'hero');
  assert.equal(hero.data.tiles[0].sub, '17 picks for students and first jobs');
  assert.equal(hero.data.tiles[1].sub, '2-in-1s from KSh 18,500');
  assert.equal(hero.data.tiles[0].href, '/shop?price=0-30000');
  const three = secs.filter((s) => s.type === 'promoBanner')[1].data.banners.map((b) => b.sub);
  assert.deepEqual(three, ['15 in stock, from KSh 18,500', '29 in stock, from KSh 30,000', '4 in stock, from KSh 23,000']);
  const tabs = secs.find((s) => s.variant === 'tabs').data.tabs;
  assert.deepEqual(tabs.map((t) => [t.label, t.all.length, t.products.length]), [['Under 30K', 17, 8], ['16GB RAM+', 14, 8], ['Touchscreen', 31, 8], ['Windows 11 ready', 42, 8]]);
  assert.ok(tabs[0].products.every((p, i, a) => i === 0 || a[i - 1].price <= p.price), 'price ascending');
  const json = JSON.stringify(secs.map((s) => s.data));
  assert.doesNotMatch(json, /\{(count|fromPrice)\}/);
});

test('no product appears in more than 2 sections', () => {
  const secs = composeHomepage(store(), catalog());
  const seen = new Map();
  for (const s of secs) {
    const list = s.data.tabs ? s.data.tabs.flatMap((t) => t.products) : s.data.products || [];
    for (const slug of new Set(list.map((p) => p.slug))) seen.set(slug, (seen.get(slug) || 0) + 1);
  }
  assert.ok([...seen.values()].every((n) => n <= 2), JSON.stringify([...seen].filter(([, n]) => n > 2)));
  const grid = secs.find((s) => s.title === 'Business laptops');
  assert.ok(!grid.data.products.some((p) => p.slug === 'dell-latitude-5400-i5-8gb-256gb-touch'), 'Latitude 5400 already shows in Staff picks and the Touchscreen tab');
});

test('filter target with <3 matches is dropped (banner, and the section needing it)', () => {
  const banners = cfg.banners.map((b) => (b.id === 'promo-graphics' ? { ...b, target: { type: 'filter', query: { ram: '32GB' } } } : b));
  const report = {};
  const secs = composeHomepage(store(), catalog({ banners }), report);
  assert.ok(!secs.some((s) => s.variant === 'twoUp'));
  assert.ok(report.dropped.some((d) => d.variant === 'twoUp'));
});

test('tab with <4 products is dropped; one tab left becomes a grid', () => {
  const sections = cfg.homepage.sections.map((s) => (s.variant === 'tabs' ? { ...s, source: { tabs: [s.source.tabs[0], { label: 'Workstations', source: { filter: { series: 'ZBook' } } }] } } : s));
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
    const firstNonAnnouncement = secs.find((s) => s.type !== 'announcement');
    assert.equal(firstNonAnnouncement.type, 'hero', `${recipe}/${tier}: ${types(secs)}`);
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
