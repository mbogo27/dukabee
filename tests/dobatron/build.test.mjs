// Spec §10.3–10.7 over the built output: privacy, homepage, product page, guide, SEO and WhatsApp links.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildStorefront, BuildError } from '../../scripts/build-storefront.mjs';
import { tempData, tempDir, walk } from './helpers.mjs';

let out, result;
const read = (p) => fs.readFileSync(path.join(out, p), 'utf8');
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');

before(async () => {
  out = tempDir();
  result = await buildStorefront('dobatron', { outDir: out, log: () => {} });
});

test('§10.3 no supplier cost anywhere in the build output', () => {
  const files = walk(out);
  assert.ok(files.length > 60);
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /77998\.7|57198\.7|25998\.7/, f);
    assert.doesNotMatch(text, /["']cost["']\s*:/, f);
  }
  const index = JSON.parse(read('shop.html').match(/<script type="application\/json" id="sf-index">([\s\S]*?)<\/script>/)[1]);
  assert.ok(index.products.every((p) => !('cost' in p) && !('sourceRows' in p)));
});

test('the build refuses to publish if cost would leak', async () => {
  const dir = tempData();
  const g = path.join(dir, 'guides', 'leak.md');
  fs.writeFileSync(g, '---\ntitle: Leak\nslug: leak\npublishedAt: 2026-10-01\n---\n\n## Notes\n\nInternal: 57198.7\n');
  await assert.rejects(buildStorefront('dobatron', { dataDir: dir, outDir: tempDir(), log: () => {} }), (e) => e instanceof BuildError && /57198\.7/.test(e.message));
});

test('§10.4 homepage: sections in order, no trust strip yet, every token interpolated', () => {
  const html = read('index.html');
  const order = [...html.matchAll(/data-section="([a-zA-Z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['announcement', 'hero', 'categoryNav', 'productRail', 'promoBanner', 'productShowcase', 'productRail', 'promoBanner', 'productRail', 'guideTeaser', 'footer']);
  assert.doesNotMatch(textOf(html), /\{[a-zA-Z]+\}/, 'no raw braces');
  assert.match(html, /17 picks for students and first jobs/);
  assert.match(html, /MacBooks from KSh 25,000/);
  assert.match(html, /8 laptops with dedicated graphics/);
  assert.match(html, /Store built on Duka Bee/);
  assert.match(html, /href="https:\/\/dukabee\.co\.ke"/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const org = ldOf(html).find((x) => x['@type'] === 'Organization');
  assert.equal(org.telephone, '+254743747496');
});

test('§10.5 product page: 840 G6 i5 Touch shows its 3 other configurations, linked correctly', () => {
  const html = read('p/hp-elitebook-840-g6-i5-8gb-256gb-touch.html');
  const chips = [...html.matchAll(/<a class="sf-chip" href="\/p\/([^"]+)"><span>([^<]+)<\/span> <span class="sf-chip__price">— ([^<]+)<\/span>/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(chips, [
    ['hp-elitebook-840-g6-i5-8gb-256gb', 'No touch', 'KSh 35,500'],
    ['hp-elitebook-840-g6-i7-8gb-256gb', 'i7 · No touch', 'KSh 39,000'],
    ['hp-elitebook-840-g6-i7-8gb-512gb', 'i7 · 512GB · No touch', 'KSh 43,000'],
  ]);
  for (const [slug] of chips) assert.ok(fs.existsSync(path.join(out, `p/${slug}.html`)));
  assert.equal((read('p/hp-elitebook-745-g6-ryzen-5-8gb-256gb.html').match(/class="sf-chip"/g) || []).length, 4, '745 G6 has 5 configurations');
  assert.ok(!/class="sf-configs"/.test(read('p/hp-zbook-firefly-14-g8-i7-32gb-512gb.html')), 'no siblings, no switcher');
});

test('§10.5 inferred specs carry ≈ and the footnote; JSON-LD is a valid Product offer', () => {
  const html = read('p/hp-elitebook-840-g6-i5-8gb-256gb-touch.html');
  assert.match(html, /<th scope="row">Screen<\/th><td>14&quot; <abbr class="sf-approx"/);
  assert.match(html, /Typical for this model\. We confirm the exact unit&#39;s specs on WhatsApp before you pay\./);
  const product = ldOf(html).find((x) => x['@type'] === 'Product');
  assert.equal(product.sku, 'hp-elitebook-840-g6-i5-8gb-256gb-touch');
  assert.equal(product.brand.name, 'HP');
  assert.equal(product.model, 'HP EliteBook 840 G6');
  assert.deepEqual({ ...product.offers, seller: undefined, url: undefined }, { '@type': 'Offer', priceCurrency: 'KES', price: '38000', availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/UsedCondition', seller: undefined, url: undefined });
  assert.match(html, /<title>HP EliteBook 840 G6 · Core i5 8th Gen, 8GB\/256GB, Touch \| Dobatron<\/title>/);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(desc.length <= 155);
  const mbp = read('p/apple-macbook-pro-13-2018-i7-16gb-512gb.html');
  assert.match(mbp, /could be the 13-inch or the 15-inch model/);
});

test('§10.6 guide: 6 embed blocks, 13 products (incl. the 3-way compare), no warnings at markup 0', () => {
  const html = read('guides/best-ex-uk-laptops-kenya-by-budget.html');
  assert.equal((html.match(/data-embed-block=/g) || []).length, 6);
  const cards = (html.match(/<article class="sf-embed/g) || []).length;
  const compareCols = (html.match(/<thead>[\s\S]*?<\/thead>/)[0].match(/<th scope="col"><a /g) || []).length;
  assert.equal(cards + compareCols, 13);
  const list = ldOf(html).find((x) => x['@type'] === 'ItemList');
  assert.equal(list.itemListElement.length, 13);
  assert.equal(list.itemListElement[0].url, 'https://dobatron.dukabee.co.ke/p/dell-latitude-5300-i5-8gb-256gb');
  assert.ok(ldOf(html).some((x) => x['@type'] === 'Article' && x.datePublished === '2026-10-08'));
  assert.deepEqual(result.warnings, []);
  assert.match(html, /<tr class="is-diff"><th scope="row">Intel generation<\/th>/, 'differing compare rows are highlighted');
});

test('§10.6 products embedded in the guide link back with "Read the guide"', () => {
  assert.match(read('p/lenovo-thinkpad-t490s-i7-16gb-512gb-touch.html'), /Read the guide: The best ex-UK laptops in Kenya by budget/);
  assert.doesNotMatch(read('p/hp-elitebook-840-g3-i7-8gb-256gb.html'), /Read the guide/);
});

test('§10.6 an unknown slug fails the build naming the file and line', async () => {
  const dir = tempData();
  const g = path.join(dir, 'guides', 'best-ex-uk-laptops-kenya-by-budget.md');
  const src = fs.readFileSync(g, 'utf8');
  fs.writeFileSync(g, src.replace('::product{slug="lenovo-thinkpad-t490s-i7-16gb-512gb-touch"', '::product{slug="nope"'));
  const line = src.split('\n').findIndex((l) => l.includes('lenovo-thinkpad-t490s-i7-16gb-512gb-touch')) + 1;
  await assert.rejects(buildStorefront('dobatron', { dataDir: dir, outDir: tempDir(), log: () => {} }),
    (e) => e instanceof BuildError && e.message.includes(`best-ex-uk-laptops-kenya-by-budget.md:${line}: unknown product slug "nope"`));
});

test('band and prose-price checks warn (not fail) when prices drift', async () => {
  const dir = tempData();
  const store = JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8'));
  store.products.find((p) => p.slug === 'dell-latitude-5300-i5-8gb-256gb').price = 27000;
  fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(store));
  fs.appendFileSync(path.join(dir, 'guides', 'best-ex-uk-laptops-kenya-by-budget.md'), '\nThe X260 is only KSh 20,500 today.\n');
  const r = await buildStorefront('dobatron', { dataDir: dir, outDir: tempDir(), log: () => {} });
  assert.ok(r.warnings.some((w) => /dell-latitude-5300-i5-8gb-256gb is now KSh 27,000, outside its band 0-25000/.test(w)));
  assert.ok(r.warnings.some((w) => /price in prose/.test(w)));
});

test('§8 SEO: titles, canonicals, sitemap and robots', () => {
  assert.match(read('index.html'), /<title>Dobatron: Ex-UK laptops in Kenya\. HP, Lenovo, Dell, Apple<\/title>/);
  assert.match(read('shop.html'), /<title>Shop ex-UK laptops \| Dobatron<\/title>/);
  assert.match(read('shop.html'), /<meta name="description" content="64 ex-UK laptops\. Filter by price, RAM, processor, touchscreen and more\.">/);
  assert.match(read('shop.html'), /<link rel="canonical" href="https:\/\/dobatron\.dukabee\.co\.ke\/shop">/);
  assert.match(read('guides/best-ex-uk-laptops-kenya-by-budget.html'), /<title>The best ex-UK laptops in Kenya by budget \(2026\) \| Dobatron<\/title>/);
  const sitemap = read('sitemap.xml');
  assert.equal((sitemap.match(/<loc>https:\/\/dobatron\.dukabee\.co\.ke\/p\//g) || []).length, 64);
  for (const loc of ['/', '/shop', '/guides', '/guides/best-ex-uk-laptops-kenya-by-budget']) assert.match(sitemap, new RegExp(`<loc>https://dobatron\\.dukabee\\.co\\.ke${loc.replace(/\//g, '\\/')}</loc>`));
  assert.ok([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].every((m) => !m[1].includes('?')), 'no filtered /shop?… URLs');
  assert.match(read('robots.txt'), /Sitemap: https:\/\/dobatron\.dukabee\.co\.ke\/sitemap\.xml/);
  assert.match(read('404.html'), /<meta name="robots" content="noindex">/);
});

test('§10.7 every WhatsApp link goes to wa.me/254743747496, with a filled message where one is expected', () => {
  for (const f of walk(out).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)) assert.match(m[1], /^https:\/\/wa\.me\/254743747496(\?text=.+)?$/, `${f}: ${m[1]}`);
  }
  const pdp = read('p/hp-elitebook-840-g6-i5-8gb-256gb-touch.html');
  const ask = decodeURIComponent(pdp.match(/href="https:\/\/wa\.me\/254743747496\?text=([^"]+)"[^>]*data-track="ask_click"/)[1].replace(/&amp;/g, '&'));
  assert.equal(ask, 'Hi Dobatron, is "HP EliteBook 840 G6 · Core i5 8th Gen, 8GB/256GB, Touch" available? Can you send photos and the battery health of this unit? https://dobatron.dukabee.co.ke/p/hp-elitebook-840-g6-i5-8gb-256gb-touch');
});

test('accessibility basics: every image placeholder has alt text, contrast pairs pass', async () => {
  for (const f of walk(out).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/<div class="sf-ph[^"]*" role="img" aria-label="([^"]*)"/g)) assert.ok(m[1].trim(), `${f}: placeholder without alt`);
  }
  const { contrast } = await import('../../pipeline/contrast.mjs');
  const ink = '#111111', paper = '#F7F5F0', accent = '#FFD60A';
  assert.ok(contrast(ink, paper) >= 4.5 && contrast(paper, ink) >= 4.5 && contrast(ink, accent) >= 4.5);
  assert.ok(contrast(accent, paper) < 3, 'yellow on paper fails, which is why yellow is only ever a background');
});
