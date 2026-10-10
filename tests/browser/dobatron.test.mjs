// Browser smoke tests for the Dobatron storefront: filters with URL state (reload, back), 360px layout, model-page
// variants, legacy redirects and the find-my-laptop quiz. Headless Chrome/Edge over the DevTools protocol; skipped
// when neither is installed.
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

test('360px: no horizontal scroll on the main page types; no script errors', { skip }, async () => {
  await page.viewport(360, 740, true);
  for (const url of ['/', '/laptops', '/laptops/hp', '/laptops/hp-elitebook', '/laptops/hp-elitebook-840-g6', '/guides/best-refurbished-laptops-kenya-by-budget', '/guides', '/about', '/find-my-laptop']) {
    await page.goto(base + url);
    const [scrollW, innerW] = await page.eval('[document.documentElement.scrollWidth, innerWidth]');
    assert.equal(scrollW, innerW, `${url} overflows at 360px`);
  }
  assert.deepEqual(page.errors, []);
});

test('filters update counts and the URL; state survives reload and the back button', { skip }, async () => {
  await page.viewport(1280, 900, false);
  await page.goto(`${base}/laptops`);
  assert.equal(await count(), '62 laptops');
  await click('input[name=brand][value=Lenovo]');
  assert.equal(await count(), '15 laptops');
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
  assert.equal(await count(), '15 laptops', 'after back');
  assert.equal(await page.eval(`document.querySelector('input[name=touch][value=Yes]').checked`), false);
});

test('faceted counts on /laptops; screen hides on /mini-pcs', { skip }, async () => {
  await page.goto(`${base}/laptops?formFactor=Convertible,Detachable`);
  assert.equal(await count(), '15 laptops');
  await click('input[name=features][value="Stylus pen"]');
  assert.equal(await count(), '7 laptops');
  await page.goto(`${base}/laptops?brand=HP,Dell&cpu=Intel+Core+i7`);
  assert.equal(await count(), '14 laptops');
  assert.equal(await page.eval(`document.querySelector('[data-facet=cpu] input[value="AMD Ryzen 7"]').disabled`), false, 'a facet\'s own filter doesn\'t zero its other values');
  await page.goto(`${base}/laptops?formFactor=Detachable`);
  assert.equal(await page.eval(`document.querySelector('[data-facet=brand] input[value="Dell"]').disabled`), true, 'zero-count values render disabled');
  await page.goto(`${base}/mini-pcs`);
  assert.equal(await count(), '2 mini PCs');
  assert.equal(await page.eval(`document.querySelector('[data-facet=screen]')?.hidden ?? true`), true, 'Screen hides under Mini PCs');
});

test('search filters live on /laptops; header search elsewhere goes to /laptops?q=', { skip }, async () => {
  await page.goto(`${base}/laptops`);
  await page.eval(`(() => { const i = document.querySelector('#sf-shop-q'); i.value = '840 g6'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.settle(300);
  assert.equal(await count(), '4 laptops');
  await page.goto(`${base}/laptops/hp-elitebook-840-g6`);
  await page.eval(`(() => { const f = document.querySelector('[data-search-form]'); f.q.value = 'tp yoga'; f.submit(); })()`);
  await page.waitFor(`location.pathname === '/laptops' && document.readyState === 'complete' && document.querySelector('[data-result-count]')?.textContent !== '62 laptops'`);
  assert.equal(await page.eval('location.pathname + location.search'), '/laptops?q=tp+yoga');
  assert.equal(await count(), '9 laptops');
});

test('empty state offers a WhatsApp "source it for me" message built from the filters', { skip }, async () => {
  await page.goto(`${base}/laptops?brand=Apple&touch=Yes`);
  assert.equal(await count(), '0 laptops');
  assert.equal(await page.eval(`document.querySelector('[data-empty]').hidden`), false);
  const href = await page.eval(`document.querySelector('[data-sourcing]').href`);
  assert.equal(decodeURIComponent(href.split('?text=')[1]), "Hi Dobatron, I'm looking for a laptop: Apple, touchscreen. Can you source one?");
});

test('a legacy /p/ link 301s to the model page with that configuration selected; switching updates ?variant=', { skip }, async () => {
  await page.send('Page.navigate', { url: `${base}/p/hp-elitebook-840-g6-i7-8gb-512gb` }); // goto() expects no redirect
  await page.waitFor(`location.pathname === '/laptops/hp-elitebook-840-g6' && document.readyState === 'complete'`);
  await page.settle(300);
  assert.equal(await page.eval(`[...document.querySelectorAll('[data-variant-panel]')].filter(p => !p.hidden).map(p => p.dataset.variantPanel).join()`), 'hp-elitebook-840-g6-i7-8gb-512gb');
  assert.equal(await page.eval(`document.querySelector('input[name=variant]:checked').value`), 'hp-elitebook-840-g6-i7-8gb-512gb');
  await click('input[name=variant][value="hp-elitebook-840-g6-i5-8gb-256gb-touch"]');
  assert.equal(await page.eval(`new URLSearchParams(location.search).get('variant')`), 'hp-elitebook-840-g6-i5-8gb-256gb-touch');
  assert.match(await page.eval(`document.querySelector('[data-variant-panel]:not([hidden]) .sf-price').textContent`), /38,000/);
  assert.equal(await page.eval(`document.querySelector('link[rel=canonical]').href`), 'https://dobatron.co.ke/laptops/hp-elitebook-840-g6');
});

test('find-my-laptop returns 2 or 3 matches with reasons, WhatsApp carrying the answers, and always something', { skip }, async () => {
  await page.goto(`${base}/find-my-laptop`);
  const answer = (a) => page.eval(`(() => { const f = document.querySelector('[data-quiz-form]'); f.hidden = false; for (const [n, v] of ${JSON.stringify(Object.entries(a))}) f.querySelector(\`input[name="\${n}"][value="\${v}"]\`).checked = true; f.requestSubmit(); })()`).then(() => page.settle(300));
  await answer({ use: 'student', budget: '0-30000', style: 'portable', touch: 'either' });
  const matches = await page.eval(`[...document.querySelectorAll('.sf-match')].map(m => ({ name: m.querySelector('h3').textContent, why: m.querySelector('.sf-match__why').textContent, wa: decodeURIComponent(m.querySelector('a[href^="https://wa.me/"]').href) }))`);
  assert.ok(matches.length >= 2 && matches.length <= 3, JSON.stringify(matches));
  assert.equal(matches[0].name, 'Dell Latitude 5300', 'Windows 11 and 8GB beat the cheapest Celeron');
  assert.ok(matches.every((m) => /good for students/.test(m.why)));
  assert.match(matches[0].wa, /suggested the Dell Latitude 5300\. What I need: Students, budget Under KSh 30K, light and portable/);
  assert.match(await page.eval(`document.querySelector('[data-quiz-results]').textContent`), /Best laptops for students/);
  await answer({ use: 'design', budget: '0-30000', style: 'portable', touch: 'yes' });
  assert.match(await page.eval(`document.querySelector('[data-quiz-results] h2').textContent`), /closest matches/);
  assert.ok(await page.eval(`document.querySelectorAll('.sf-match').length`) >= 1);
});

test('homepage tabs switch panels', { skip }, async () => {
  await page.goto(`${base}/`);
  await click('[role=tab]:nth-child(2)');
  assert.deepEqual(await page.eval(`[...document.querySelectorAll('[role=tabpanel]')].map(p => p.hidden)`), [true, false, true, true]);
  assert.deepEqual(page.errors, []);
});
