// Build output against dobatron-store-spec §10 and the Dobatron Site Structure Spec (URLs, page templates, linking,
// canonicals, trust layer, claims).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildStorefront, BuildError } from '../../scripts/build-storefront.mjs';
import { tempData, tempDir, walk, readJson, DATA } from './helpers.mjs';

const models = readJson(path.join(DATA, 'models.json')).models;
const products = readJson(path.join(DATA, 'products.json')).products;
const taxonomy = readJson(path.join(DATA, 'taxonomy.json'));
const ORIGIN = 'https://dobatron.co.ke';
let out, result;
const read = (p) => fs.readFileSync(path.join(out, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(out, p));
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
const crumbsOf = (html) => [...(html.match(/<nav class="sf-crumbs"[\s\S]*?<\/nav>/)?.[0] || '').matchAll(/<li>(?:<a href="([^"]+)">([^<]+)<\/a>|<span[^>]*>([^<]+)<\/span>)<\/li>/g)].map((m) => (m[1] ? `${m[2]}→${m[1]}` : m[3]));
const htmlFiles = () => walk(out).filter((f) => f.endsWith('.html'));

before(async () => {
  out = tempDir();
  result = await buildStorefront('dobatron', { outDir: out, log: () => {} });
});

// ---------------- privacy ----------------
test('§10.3 no supplier cost anywhere in the build output', () => {
  const files = walk(out).filter((f) => !/\.(webp|png|jpe?g)$/.test(f));
  assert.ok(files.length > 60);
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /77998\.7|57198\.7|25998\.7/, f);
    assert.doesNotMatch(text, /["']cost["']\s*:/, f);
  }
  const index = JSON.parse(read('laptops.html').match(/<script type="application\/json" id="sf-index">([\s\S]*?)<\/script>/)[1]);
  assert.ok(index.products.every((p) => !('cost' in p) && !('sourceRows' in p)));
});

test('the build refuses to publish if cost would leak', async () => {
  const dir = tempData();
  fs.writeFileSync(path.join(dir, 'guides', 'leak.md'), '---\ntitle: Leak\nslug: leak\npublishedAt: 2026-10-01\n---\n\n## Notes\n\nInternal: 57198.7\n');
  await assert.rejects(buildStorefront('dobatron', { dataDir: dir, outDir: tempDir(), log: () => {} }), (e) => e instanceof BuildError && /57198\.7/.test(e.message));
});

// ---------------- URL scheme ----------------
test('product tree URLs: /laptops, /laptops/<brand|series|model>, /mini-pcs; no /p/ or /shop pages', () => {
  for (const p of ['index.html', 'laptops.html', 'mini-pcs.html', 'laptops/hp.html', 'guides.html', 'about.html', 'grade-a.html', 'how-it-works.html', 'find-my-laptop.html']) assert.ok(exists(p), p);
  for (const s of taxonomy.series) assert.ok(exists(`${s.category}/${s.slug}.html`), s.slug);
  for (const m of models) assert.ok(exists(`${m.category}/${m.slug}.html`), m.slug);
  assert.ok(!exists('laptops/lenovo.html') && !exists('laptops/dell.html') && !exists('laptops/apple.html'), 'brand pages only for 2+ stocked series');
  assert.ok(!exists('mini-pcs/hp.html'), 'one series is not enough for a brand page');
  assert.ok(!exists('p') && !exists('shop.html'), 'legacy pages are redirects now, not pages');
  for (const m of models) assert.doesNotMatch(m.slug, /\d{2,}gb|grade|ksh|\bi[357]\b/, `no specs or price in slug: ${m.slug}`);
});

test('legacy URLs 301 to the new tree: every /p/<offer> → its model ?variant=, /shop → /laptops, renamed guide', () => {
  const r = JSON.parse(read('redirects.json'));
  assert.equal(r['/shop'], '/laptops');
  assert.equal(r['/guides/best-ex-uk-laptops-kenya-by-budget'], '/guides/best-refurbished-laptops-kenya-by-budget');
  for (const p of products) {
    const m = models.find((x) => x.modelId === p.modelId);
    assert.equal(r[`/p/${p.slug}`], `/${m.category}/${m.slug}?variant=${p.slug}`);
  }
});

// ---------------- homepage ----------------
test('homepage: sections in order with the trust strip, series navigation, tokens interpolated', () => {
  const html = read('index.html');
  const order = [...html.matchAll(/data-section="([a-zA-Z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['announcement', 'hero', 'categoryNav', 'productRail', 'promoBanner', 'productShowcase', 'productRail', 'promoBanner', 'productRail', 'guideTeaser', 'trustStrip', 'footer']);
  assert.doesNotMatch(textOf(html), /\{[a-zA-Z]+\}/, 'no raw braces');
  assert.match(html, /15 picks for students and first jobs/);
  assert.match(html, /href="\/find-my-laptop"/);
  assert.match(html, /href="\/laptops\/lenovo-thinkpad"/);
  assert.match(html, /Built by Duka Bee/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal(ldOf(html).find((x) => x['@type'] === 'Organization').telephone, '+254797809836');
});

// ---------------- category, brand, series ----------------
test('category page /laptops: laptops only, filters, series links, canonical to itself', () => {
  const html = read('laptops.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/dobatron\.co\.ke\/laptops">/);
  assert.equal((html.match(/<article class="sf-card/g) || []).length, 62, '64 offers minus 2 mini PCs');
  assert.doesNotMatch(html, /data-slug="hp-elitedesk|data-slug="lenovo-thinkcentre/);
  assert.match(html, /data-filters/);
  for (const s of taxonomy.series.filter((x) => x.category === 'laptops')) assert.match(html, new RegExp(`href="/laptops/${s.slug}"`));
  assert.deepEqual(crumbsOf(html), ['Home→/', 'Computers', 'Laptops']);
  assert.equal((read('mini-pcs.html').match(/<article class="sf-card/g) || []).length, 2);
});

test('brand page /laptops/hp links down to its series', () => {
  const html = read('laptops/hp.html');
  for (const s of ['hp-elitebook', 'hp-probook', 'hp-zbook', 'hp-elite-x2']) assert.match(html, new RegExp(`href="/laptops/${s}"`));
  assert.deepEqual(crumbsOf(html), ['Home→/', 'Computers', 'Laptops→/laptops', 'HP']);
});

test('series page: dated price line, summary box, models table, anchored price sections, advice, series FAQ', () => {
  const html = read('laptops/hp-elitebook.html');
  assert.match(html, /<p class="sf-priceline"><strong>HP EliteBook price in Kenya:<\/strong> <span class="sf-mono">KSh 30,000 – 60,000<\/span><span class="sf-priceline__meta"> · Grade A · as of <time/);
  assert.match(html, /class="sf-summary"/);
  assert.match(html, /Known for:/);
  const eb = models.filter((m) => m.seriesSlug === 'hp-elitebook');
  assert.equal((html.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr>/g) || []).length, eb.length);
  for (const m of eb) {
    assert.match(html, new RegExp(`<section class="sf-series__model" id="${m.slug}">\\s*<h2>${m.name} price in Kenya</h2>`));
    assert.match(html, new RegExp(`href="/laptops/${m.slug}"`));
  }
  assert.match(html, /Which EliteBook should you buy\?/);
  const faq = ldOf(html).find((x) => x['@type'] === 'FAQPage');
  assert.ok(faq.mainEntity.some((q) => /How much does a HP EliteBook cost in Kenya\?/.test(q.name)));
  assert.ok(faq.mainEntity.some((q) => /What does the G number/.test(q.name)));
  assert.deepEqual(crumbsOf(html), ['Home→/', 'Computers', 'Laptops→/laptops', 'HP→/laptops/hp', 'EliteBook']);
  assert.match(html, /href="\/laptops">All laptops/, 'links up to its category');
});

// ---------------- model page ----------------
test('model page: one URL per model, variant selector, dated price range, WhatsApp with the model name', () => {
  const html = read('laptops/hp-elitebook-840-g6.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/dobatron\.co\.ke\/laptops\/hp-elitebook-840-g6">/);
  assert.equal((html.match(/<input type="radio" name="variant"/g) || []).length, 4);
  assert.match(html, /<input type="radio" name="variant" value="hp-elitebook-840-g6-i5-8gb-256gb" checked>/, 'cheapest available is the default');
  assert.equal((html.match(/data-variant-panel=/g) || []).length, 4);
  assert.match(html, /HP EliteBook 840 G6 price in Kenya:<\/strong> <span class="sf-mono">KSh 35,500 – 43,000/);
  assert.match(html, /Condition: <a href="\/grade-a">Grade A<\/a>/);
  assert.match(html, /Available through our supplier network · confirm on WhatsApp/);
  const ask = decodeURIComponent(html.match(/href="https:\/\/wa\.me\/254797809836\?text=([^"]+)"[^>]*data-track="ask_click"/)[1].replace(/&amp;/g, '&'));
  assert.equal(ask, 'Hi Dobatron, is "HP EliteBook 840 G6 · Core i5 8th Gen, 8GB/256GB" available? Can you send photos and the battery health of this unit? https://dobatron.co.ke/laptops/hp-elitebook-840-g6?variant=hp-elitebook-840-g6-i5-8gb-256gb');
  assert.match(html, /Request a video of this machine/);
  assert.match(html, /class="sf-confidence"/, 'buy-with-confidence strip');
  assert.match(html, /<th scope="row">Screen<\/th><td>14&quot; <abbr class="sf-approx"/);
  assert.match(html, /Typical for this model\. We confirm the exact unit&#39;s specs on WhatsApp before you pay\./);
  assert.deepEqual(crumbsOf(html), ['Home→/', 'Computers', 'Laptops→/laptops', 'HP→/laptops/hp', 'EliteBook→/laptops/hp-elitebook', '840 G6']);
  const product = ldOf(html).find((x) => x['@type'] === 'Product');
  assert.deepEqual({ ...product.offers, seller: undefined }, { '@type': 'AggregateOffer', priceCurrency: 'KES', lowPrice: '35500', highPrice: '43000', offerCount: '4', availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/RefurbishedCondition', seller: undefined });
  assert.equal(product.url, `${ORIGIN}/laptops/hp-elitebook-840-g6`);
  assert.match(html, /<title>HP EliteBook 840 G6 price in Kenya \| Dobatron<\/title>/);
  assert.ok(html.match(/<meta name="description" content="([^"]*)"/)[1].length <= 155);
  assert.match(html, /href="\/laptops\/hp-elitebook">All HP EliteBook models and prices/, 'links up to its series');
  assert.match(html, /Similar laptops/);
  assert.match(read('laptops/apple-macbook-pro-13-2018.html'), /could be the 13-inch or the 15-inch model/);
});

test('every model page has a real photo (own or a labelled stand-in) and og:image on .co.ke', () => {
  for (const m of models) {
    const html = read(`${m.category}/${m.slug}.html`);
    const src = html.match(/<div class="sf-pdp__media">[\s\S]*?<img class="sf-img [^"]*" src="(\/images\/[^"]+\.webp)" alt="([^"]+)" width="\d+" height="\d+"/);
    assert.ok(src, `${m.slug}: no photo`);
    assert.ok(exists(src[1].slice(1)), `${m.slug}: ${src[1]} missing from the build`);
    assert.match(html, /<meta property="og:image" content="https:\/\/dobatron\.co\.ke\/images\//);
  }
  assert.match(read('laptops/hp-elitebook-845-g8.html'), /Photo shows a similar model \(HP EliteBook 840 G6\)/);
  assert.doesNotMatch(read('laptops/hp-elitebook-840-g6.html'), /Photo shows a similar model/);
  assert.equal((read('laptops/hp-zbook-firefly-14-g8.html').match(/data-gallery-to=/g) || []).length, 2);
});

// ---------------- guides ----------------
test('guides are records: breadcrumbs, dates, related guides; the budget guide keeps its 6 embed blocks', () => {
  const html = read('guides/best-refurbished-laptops-kenya-by-budget.html');
  assert.equal((html.match(/data-embed-block=/g) || []).length, 6);
  const list = ldOf(html).find((x) => x['@type'] === 'ItemList');
  assert.equal(list.itemListElement.length, 13, 'featured models, each once');
  assert.ok(list.itemListElement.every((i) => i.url.startsWith(`${ORIGIN}/laptops/`)));
  assert.deepEqual(crumbsOf(html), ['Home→/', 'Guides→/guides', 'The best refurbished laptops in Kenya by budget (2026)']);
  assert.match(html, /Prices and stock checked/);
  assert.ok(ldOf(html).some((x) => x['@type'] === 'FAQPage'));
  assert.match(html, /<tr class="is-diff"><th scope="row">Intel generation<\/th>/);
  assert.deepEqual(result.warnings, []);
});

test('use-case guides list products by tag query, linking to model pages', () => {
  for (const g of ['best-laptops-for-students-kenya', 'best-laptops-for-programming-kenya', 'best-laptops-for-graphic-design-kenya']) {
    const html = read(`guides/${g}.html`);
    const cards = [...html.matchAll(/<article class="sf-card sf-card--model[^"]*" data-model="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(cards.length >= 3, `${g}: ${cards.length} model cards`);
    for (const slug of cards) assert.ok(exists(`laptops/${slug}.html`));
    assert.ok(ldOf(html).some((x) => x['@type'] === 'FAQPage'), `${g}: FAQ`);
    assert.match(html.split('<div class="sf-prose">')[1], /^<p>Short answer:/, `${g}: direct answer first`);
  }
  const students = [...read('guides/best-laptops-for-students-kenya.html').matchAll(/data-model="([^"]+)"/g)].map((m) => m[1]);
  for (const slug of students) assert.ok(models.find((m) => m.slug === slug).tags.use_case.includes('student'));
});

test('models link across to guides that feature them or share their tags', () => {
  assert.match(read('laptops/lenovo-thinkpad-t490s.html'), /href="\/guides\/best-refurbished-laptops-kenya-by-budget"/);
  assert.match(read('laptops/hp-zbook-firefly-14-g8.html'), /href="\/guides\/best-laptops-for-graphic-design-kenya"/);
});

test('an unknown slug in a guide fails the build naming the file and line', async () => {
  const dir = tempData();
  const g = path.join(dir, 'guides', 'best-refurbished-laptops-kenya-by-budget.md');
  const src = fs.readFileSync(g, 'utf8');
  fs.writeFileSync(g, src.replace('::product{slug="lenovo-thinkpad-t490s-i7-16gb-512gb-touch"', '::product{slug="nope"'));
  const line = src.split('\n').findIndex((l) => l.includes('::product{slug="lenovo-thinkpad-t490s-i7-16gb-512gb-touch"')) + 1;
  await assert.rejects(buildStorefront('dobatron', { dataDir: dir, outDir: tempDir(), log: () => {} }),
    (e) => e instanceof BuildError && e.message.includes(`best-refurbished-laptops-kenya-by-budget.md:${line}: unknown product slug "nope"`));
});

test('band and prose-price checks warn (not fail) when prices drift', async () => {
  const dir = tempData();
  const pd = JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8'));
  pd.products.find((p) => p.slug === 'dell-latitude-5300-i5-8gb-256gb').price = 27000;
  fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(pd));
  fs.appendFileSync(path.join(dir, 'guides', 'best-refurbished-laptops-kenya-by-budget.md'), '\nThe X260 is only KSh 20,500 today.\n');
  const r = await buildStorefront('dobatron', { dataDir: dir, outDir: tempDir(), log: () => {} });
  assert.ok(r.warnings.some((w) => /dell-latitude-5300-i5-8gb-256gb is now KSh 27,000, outside its band 0-25000/.test(w)));
  assert.ok(r.warnings.some((w) => /price in prose/.test(w)));
});

test('one namespace per category: a series and a model can never share a slug', async () => {
  const dir = tempData();
  const tx = JSON.parse(fs.readFileSync(path.join(dir, 'taxonomy.json'), 'utf8'));
  tx.series.find((s) => s.slug === 'dell-latitude').slug = 'dell-latitude-5300';
  for (const m of JSON.parse(fs.readFileSync(path.join(dir, 'models.json'), 'utf8')).models) void m;
  const md = JSON.parse(fs.readFileSync(path.join(dir, 'models.json'), 'utf8'));
  md.models.filter((m) => m.seriesSlug === 'dell-latitude').forEach((m) => { m.seriesSlug = 'dell-latitude-5300'; });
  fs.writeFileSync(path.join(dir, 'taxonomy.json'), JSON.stringify(tx));
  fs.writeFileSync(path.join(dir, 'models.json'), JSON.stringify(md));
  await assert.rejects(buildStorefront('dobatron', { dataDir: dir, outDir: tempDir(), log: () => {} }), (e) => e instanceof BuildError && /\/laptops\/dell-latitude-5300 is claimed by both/.test(e.message));
});

// ---------------- trust layer and claims ----------------
test('trust pages: About (real names, how it works), Grade A, How it works', () => {
  const about = textOf(read('about.html'));
  assert.match(about, /Mbogo/);
  assert.match(about, /Francis/);
  assert.doesNotMatch(about, /Godfrey/, 'open decision: not shown until confirmed');
  assert.match(textOf(read('grade-a.html')), /Grade A is the only grade we sell/);
  assert.match(textOf(read('grade-a.html')), /rejected, not listed at a lower grade/);
  assert.match(textOf(read('how-it-works.html')), /Inspect it/);
  for (const nav of ['/about', '/grade-a', '/how-it-works']) assert.match(read('index.html'), new RegExp(`href="${nav}"`), `footer links ${nav}`);
});

test('claims: no "ex-UK", no "in stock" promises, Grade A everywhere a condition is shown', () => {
  for (const f of htmlFiles()) {
    const text = textOf(fs.readFileSync(f, 'utf8'));
    assert.doesNotMatch(text, /ex-UK/i, f);
    assert.doesNotMatch(text, /in stock in Nairobi|\bIn stock\b/, f);
    assert.doesNotMatch(text, /Condition:\s*(?!\s|Grade A)/, f);
  }
});

// ---------------- SEO ----------------
test('canonicals, sitemap and robots use dobatron.co.ke; the quiz and filtered views are not indexed', () => {
  const sitemap = read('sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.every((l) => l.startsWith(`${ORIGIN}/`)));
  assert.ok(locs.every((l) => !l.includes('?') && !l.includes('/p/') && !l.includes('/shop')));
  for (const p of ['/', '/laptops', '/mini-pcs', '/laptops/hp', '/laptops/hp-elitebook', '/laptops/hp-elitebook-840-g6', '/guides', '/guides/best-laptops-for-students-kenya', '/about', '/grade-a', '/how-it-works']) assert.ok(locs.includes(`${ORIGIN}${p}`), p);
  assert.equal(locs.filter((l) => /\/laptops\/|\/mini-pcs\//.test(l)).length, models.length + taxonomy.series.length + 1);
  assert.ok(!locs.includes(`${ORIGIN}/find-my-laptop`));
  assert.match(read('find-my-laptop.html'), /<meta name="robots" content="noindex, follow">/);
  assert.match(read('robots.txt'), /Sitemap: https:\/\/dobatron\.co\.ke\/sitemap\.xml/);
  for (const f of htmlFiles()) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /rel="canonical" href="https:\/\/(?!dobatron\.co\.ke)/, f);
});

test('every WhatsApp link goes to wa.me/254797809836', () => {
  for (const f of htmlFiles()) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)) assert.match(m[1], /^https:\/\/wa\.me\/254797809836(\?text=.+)?$/, `${f}: ${m[1]}`);
  }
});

test('accessibility basics: placeholders have alt text, contrast pairs pass', async () => {
  for (const f of htmlFiles()) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/<div class="sf-ph[^"]*" role="img" aria-label="([^"]*)"/g)) assert.ok(m[1].trim(), `${f}: placeholder without alt`);
  }
  const { contrast } = await import('../../pipeline/contrast.mjs');
  const { primary: ink, paper, accent } = readJson(path.join(DATA, 'store.json')).store.palette;
  assert.equal(ink, '#0B2A55');
  assert.equal(accent, '#FFD60A');
  assert.ok(contrast(ink, paper) >= 4.5 && contrast(paper, ink) >= 4.5 && contrast(ink, accent) >= 4.5, 'navy on paper, paper on navy, navy on yellow');
  assert.ok(contrast(accent, ink) >= 4.5, 'yellow headings in the navy footer');
  assert.ok(contrast(accent, paper) < 3, 'yellow on paper fails, which is why yellow is only ever a background');
});

test('brand: navy theme, logo in the header, light logo in the footer, favicon set on every page', () => {
  for (const f of htmlFiles()) {
    const html = fs.readFileSync(f, 'utf8');
    assert.match(html, /<header class="sf-header">[\s\S]*?<img class="sf-logo__img" src="\/brand\/logo\.png" alt="Dobatron" width="568" height="96"/, f);
    assert.match(html, /<footer[\s\S]*?<img class="sf-logo__img" src="\/brand\/logo-light\.png"/, f);
    assert.match(html, /<link rel="icon" href="\/brand\/favicon\.ico" sizes="any">/, f);
    assert.match(html, /<link rel="apple-touch-icon" href="\/brand\/apple-touch-icon\.png">/, f);
    assert.match(html, /--ink:#0B2A55;--accent:#FFD60A/, f);
    assert.match(html, /<meta name="theme-color" content="#0B2A55">/, f);
  }
  for (const p of ['brand/logo.png', 'brand/logo-light.png', 'brand/favicon.ico', 'brand/favicon-32.png', 'brand/apple-touch-icon.png', 'brand/icon-512.png', 'favicon.ico']) assert.ok(exists(p), p);
  assert.ok(!exists('favicon.svg'), 'the generated letter icon is replaced by the real one');
  assert.equal(ldOf(read('index.html')).find((x) => x['@type'] === 'Organization').logo, `${ORIGIN}/brand/icon-512.png`);
  assert.match(read('about.html'), /<meta property="og:image" content="https:\/\/dobatron\.co\.ke\/brand\/icon-512\.png">/, 'pages without a product photo share the logo');
});
