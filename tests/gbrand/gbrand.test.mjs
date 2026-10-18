import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { totals, orderMessage, makeRef, lineKey } from '../../stores/gbrand/cart-logic.js';
import { buildGbrand, renderMarkdown } from '../../scripts/build-gbrand.mjs';

const store = JSON.parse(fs.readFileSync('data/gbrand/store.json', 'utf8'));
const mk = (price) => ({ price, category: 'jerseys', name: 'Kit', no: '01', sku: 'GB-01' });
const P = { a: mk(1499), b: mk(1499), c: mk(1499) };
const offers = store.offers;
const L = (slug, qty = 1, print = null) => ({ k: lineKey(slug, 'M', print), slug, size: 'M', print, qty });

test('two kits at 1,499 total 2,998 with no discount', () => {
  const t = totals([L('a'), L('b')], P, offers);
  assert.equal(t.total, 2998); assert.equal(t.discount, 0);
});
test('lower pairPrice gives a pair deal, never negative; three kits pair the two dearest', () => {
  const o = { ...offers, pairBundle: { ...offers.pairBundle, pairPrice: 2500 } };
  assert.equal(totals([L('a'), L('b')], P, o).discount, 498);
  const p3 = { a: mk(1499), b: mk(1499), c: mk(999) };
  assert.equal(totals([L('a'), L('b'), L('c')], p3, o).discount, 498);
  assert.equal(totals([L('a'), L('b')], P, { ...offers, pairBundle: { ...offers.pairBundle, pairPrice: 5000 } }).discount, 0);
});
test('print fee is charged but excluded from the pair deal', () => {
  const t = totals([L('a', 1, { name: 'X', number: '1' }), L('b')], P, offers);
  assert.equal(t.subtotal, 3498); assert.equal(t.discount, 0);
});
test('WhatsApp message follows the template and carries the ref', () => {
  const m = orderMessage({ template: store.checkout.messageTemplate, lines: [L('a', 1, { name: 'OTIENO', number: '10' })], products: P, offers, customer: { name: 'Jo', fulfilment: 'Pickup' }, ref: 'GB-261018-ABCD' });
  assert.equal(m, "Hi GBRAND, I'd like to order (Ref GB-261018-ABCD):\n• Kit (No.01) — Size M — Print: OTIENO 10 ×1 — KSh 1,999\n\nSubtotal: KSh 1,999\nTotal: KSh 1,999 + delivery\n\nName: Jo\nPhone: —\nDelivery: Pickup\nLocation: —");
});
test('order ref format', () => assert.match(makeRef(), /^GB-\d{6}-[A-Z2-9]{4}$/));
test('markdown: tables, lists, quotes', () => {
  const h = renderMarkdown('## T\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- **x**\n\n1. y\n\n> q');
  for (const s of ['<h2 id="t">T</h2>', '<table>', '<ul><li><strong>x</strong>', '<ol><li>y', '<blockquote>q']) assert.ok(h.includes(s), s);
});
test('build: every route, JSON-LD, no sale or banned words', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrand-'));
  const r = await buildGbrand({ outDir: out, preview: false });
  assert.equal(r.products, 14);
  for (const f of ['index.html', 'shop.html', 'brand.html', 'magazine.html', '404.html', 'sitemap.xml', 'robots.txt', 'product/arsenal-green-leaf.html', 'magazine/five-kits.html']) assert.ok(fs.existsSync(path.join(out, f)), f);
  const pdp = fs.readFileSync(path.join(out, 'product/arsenal-green-leaf.html'), 'utf8');
  assert.match(pdp, /"@type":"Product"/);
  const copy = ['index.html', 'brand.html', 'shop.html'].map((f) => fs.readFileSync(path.join(out, f), 'utf8').replace(/<script[\s\S]*?<\/script>|<[^>]+>/g, ' ')).join(' ');
  assert.doesNotMatch(copy, /\b(official|authentic)\b/i);
  assert.doesNotMatch(copy, /On offer/);
  fs.rmSync(out, { recursive: true, force: true });
});

test('preview build: base path on every URL, ribbon, noindex, ordering off, no sitemap', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrand-pv-'));
  const r = await buildGbrand({ outDir: out, preview: true });
  assert.match(r.base, /^\/preview\/gbrand-[a-z0-9]+$/);
  for (const f of ['index.html', 'shop.html', 'product/arsenal-green-leaf.html', 'magazine/five-kits.html', '404.html']) {
    const h = fs.readFileSync(path.join(out, f), 'utf8');
    assert.deepEqual([...h.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('//') && !u.startsWith(r.base + '/')), [], `${f} has un-prefixed URLs`);
    assert.match(h, /noindex, nofollow/); assert.match(h, /Ordering is off/);
  }
  assert.ok(!fs.existsSync(path.join(out, 'sitemap.xml')));
  assert.match(fs.readFileSync(path.join(out, 'product/arsenal-green-leaf.html'), 'utf8'), /Ordering opens at launch/);
  assert.match(fs.readFileSync(path.join(out, 'catalog.js'), 'utf8'), /"preview":true/);
  fs.rmSync(out, { recursive: true, force: true });
});
test('v1.2 home: split hero stack skips the spotlight, join is a wa.me button', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrand-h-'));
  await buildGbrand({ outDir: out, preview: false });
  const h = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(h, /hero__stack/); assert.doesNotMatch(h, /hstk--front"><img src="[^"]*arsenal-green-leaf/);
  assert.match(h, /id="joinWa" href="https:\/\/wa\.me\/254794790575\?text=Hi%20GBRAND%2C%20add%20me/); assert.doesNotMatch(h, /joinPhone/);
  const post = fs.readFileSync(path.join(out, 'magazine/size-guide.html'), 'utf8');
  assert.match(post, /class="toc"/); assert.match(post, /Ask us on WhatsApp/);
  fs.rmSync(out, { recursive: true, force: true });
});
