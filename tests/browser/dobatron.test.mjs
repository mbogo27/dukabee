// Browser smoke tests for the Dobatron storefront (spec §10.2 "survives reload and back button", §10.7 360px).
// Runs headless Chrome/Edge over the DevTools protocol; skipped when neither is installed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildStorefront } from '../../scripts/build-storefront.mjs';
import { serve } from '../../scripts/preview.mjs';
import { launch, findChrome } from './cdp.mjs';
import { tempDir } from '../dobatron/helpers.mjs';

const skip = !findChrome() && 'no Chrome/Edge installed (set CHROME_PATH)';
let server, page, base;

before(async () => {
  if (skip) return;
  const out = tempDir();
  await buildStorefront('dobatron', { outDir: out, log: () => {} });
  const port = 8800 + Math.floor(Math.random() * 400);
  server = serve(out, port);
  base = `http://localhost:${port}`;
  page = await launch();
});
after(async () => { await page?.close(); server?.close(); });

const visibleCards = () => page.eval(`[...document.querySelectorAll('#sf-results .sf-card')].filter(c => !c.hidden).length`);
const count = () => page.eval(`document.querySelector('[data-result-count]').textContent`);
const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)}).click()`).then(() => page.settle(150));

test('360px: no horizontal scroll on home, shop, product and guide; no script errors', { skip }, async () => {
  await page.viewport(360, 740, true);
  for (const url of ['/', '/shop', '/p/hp-elitebook-840-g6-i5-8gb-256gb-touch', '/guides/best-ex-uk-laptops-kenya-by-budget', '/guides']) {
    await page.goto(base + url);
    const [scrollW, innerW] = await page.eval('[document.documentElement.scrollWidth, innerWidth]');
    assert.equal(scrollW, innerW, `${url} overflows at 360px`);
  }
  assert.deepEqual(page.errors, []);
});

test('filters update counts and the URL; state survives reload and the back button', { skip }, async () => {
  await page.viewport(1280, 900, false);
  await page.goto(`${base}/shop`);
  assert.equal(await count(), '64 laptops');
  await click('input[name=brand][value=Lenovo]');
  assert.equal(await count(), '16 laptops');
  await click('input[name=touch][value=Yes]');
  assert.equal(await count(), '10 laptops');
  assert.equal(await visibleCards(), 10);
  assert.match(await page.eval('location.search'), /^\?brand=Lenovo&touch=Yes$/);

  await page.goto(await page.eval('location.href'));
  assert.equal(await count(), '10 laptops', 'after reload');
  assert.equal(await page.eval(`document.querySelector('input[name=touch][value=Yes]').checked`), true);
  assert.equal(await page.eval(`document.querySelector('meta[name=robots]')?.content`), 'noindex, follow');

  await page.back();
  assert.equal(await page.eval('location.search'), '?brand=Lenovo');
  assert.equal(await count(), '16 laptops', 'after back');
  assert.equal(await page.eval(`document.querySelector('input[name=touch][value=Yes]').checked`), false);
});

test('category chips, price buckets and the faceted counts', { skip }, async () => {
  await page.goto(`${base}/shop?category=2-in-1`);
  assert.equal(await count(), '15 laptops');
  await click('input[name=features][value="Stylus pen"]');
  assert.equal(await count(), '7 laptops');
  await page.goto(`${base}/shop?brand=HP,Dell&cpu=Intel+Core+i7`);
  assert.equal(await count(), '14 laptops');
  assert.equal(await page.eval(`document.querySelector('[data-facet=cpu] input[value="AMD Ryzen 7"]').disabled`), false, 'a facet\'s own filter doesn\'t zero its other values');
  await page.goto(`${base}/shop?category=2-in-1`);
  assert.equal(await page.eval(`document.querySelector('[data-facet=brand] input[value="Dell"]').disabled`), true, 'zero-count values render disabled');
  await page.goto(`${base}/shop?category=mini-pcs`);
  assert.equal(await page.eval(`document.querySelector('[data-facet=screen]').hidden`), true, 'Screen hides under Mini PCs');
});

test('search filters live on /shop; header search elsewhere goes to /shop?q=', { skip }, async () => {
  await page.goto(`${base}/shop`);
  await page.eval(`(() => { const i = document.querySelector('#sf-shop-q'); i.value = '840 g6'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.settle(300);
  assert.equal(await count(), '4 laptops');
  await page.goto(`${base}/p/hp-elitebook-840-g6-i5-8gb-256gb-touch`);
  await page.eval(`(() => { const f = document.querySelector('[data-search-form]'); f.q.value = 'tp yoga'; f.submit(); })()`);
  await page.waitFor(`location.pathname === '/shop' && document.readyState === 'complete' && document.querySelector('[data-result-count]')?.textContent !== '64 laptops'`);
  assert.equal(await page.eval('location.pathname + location.search'), '/shop?q=tp+yoga');
  assert.equal(await count(), '9 laptops');
});

test('empty state offers a WhatsApp "find it for me" message built from the filters', { skip }, async () => {
  await page.goto(`${base}/shop?brand=Apple&touch=Yes`);
  assert.equal(await count(), '0 laptops');
  assert.equal(await page.eval(`document.querySelector('[data-empty]').hidden`), false);
  const href = await page.eval(`document.querySelector('[data-sourcing]').href`);
  assert.equal(decodeURIComponent(href.split('?text=')[1]), "Hi Dobatron, I'm looking for a laptop: Apple, touchscreen. Can you find one?");
});

test('homepage tabs switch panels', { skip }, async () => {
  await page.goto(`${base}/`);
  await click('[role=tab]:nth-child(2)');
  assert.deepEqual(await page.eval(`[...document.querySelectorAll('[role=tabpanel]')].map(p => p.hidden)`), [true, false, true, true]);
  assert.deepEqual(page.errors, []);
});
