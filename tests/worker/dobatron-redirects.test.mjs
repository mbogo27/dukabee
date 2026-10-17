// Worker routing for Dobatron's domain migration (dobatron.com → dobatron.co.ke): every old or alias URL reaches
// its final .co.ke page in exactly one 301, .co.ke serves one canonical form, and other stores are untouched.
// Runs worker/index.mjs in Node with the cloudflare:workers import shimmed and a fake ASSETS binding over dist/.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildStorefront } from '../../scripts/build-storefront.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let worker, env;

before(async () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-dist-'));
  await buildStorefront('dobatron', { outDir: path.join(dist, 'stores', 'dobatron'), log: () => {} });
  fs.mkdirSync(path.join(dist, 'stores', 'faith'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'stores', 'faith', 'index.html'), '<title>Faith</title>');
  fs.writeFileSync(path.join(dist, 'index.html'), '<title>Duka Bee</title>');
  const src = fs.readFileSync(path.join(ROOT, 'worker/index.mjs'), 'utf8')
    .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor() {} }')
    .replace("from '../launch/addons.mjs'", `from '${pathToFileURL(path.join(ROOT, 'launch/addons.mjs')).href}'`);
  const shim = path.join(dist, 'worker-shim.mjs');
  fs.writeFileSync(shim, src);
  worker = (await import(pathToFileURL(shim).href)).default;
  // Cloudflare's asset layer: /x serves x.html (even when an x/ folder exists), folders serve index.html.
  env = { ASSETS: { async fetch(req) {
    const u = new URL(req.url ?? req);
    let f = path.join(dist, decodeURIComponent(u.pathname));
    if (fs.existsSync(`${f}.html`)) f = `${f}.html`;
    else if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    return fs.existsSync(f) && fs.statSync(f).isFile() ? new Response(fs.readFileSync(f), { status: 200 }) : new Response('nf', { status: 404 });
  } } };
});

const hit = async (u) => { const r = await worker.fetch(new Request(u), env); return { status: r.status, location: r.headers.get('location'), robots: r.headers.get('x-robots-tag') }; };
const redirectsTo = async (from, to) => assert.deepEqual(await hit(from), { status: 301, location: to, robots: null }, from);

test('dobatron.com and www, http or https: one 301 to the same path on https://dobatron.co.ke', async () => {
  for (const host of ['http://dobatron.com', 'https://dobatron.com', 'http://www.dobatron.com', 'https://www.dobatron.com']) {
    await redirectsTo(`${host}/`, 'https://dobatron.co.ke/');
    await redirectsTo(`${host}/laptops/dell-latitude-5300`, 'https://dobatron.co.ke/laptops/dell-latitude-5300');
    await redirectsTo(`${host}/laptops?brand=HP&ram=16GB`, 'https://dobatron.co.ke/laptops?brand=HP&ram=16GB');
  }
});

test('old /p/, /shop and renamed guide URLs on .com go straight to the final .co.ke page', async () => {
  await redirectsTo('https://dobatron.com/p/dell-latitude-5300-i5-8gb-256gb', 'https://dobatron.co.ke/laptops/dell-latitude-5300?variant=dell-latitude-5300-i5-8gb-256gb');
  await redirectsTo('http://www.dobatron.com/p/hp-elitebook-840-g6-i5-8gb-256gb-touch', 'https://dobatron.co.ke/laptops/hp-elitebook-840-g6?variant=hp-elitebook-840-g6-i5-8gb-256gb-touch');
  await redirectsTo('https://dobatron.com/p/lenovo-thinkcentre-m73-tiny-i5-8gb-500gb', 'https://dobatron.co.ke/mini-pcs/lenovo-thinkcentre-m73-tiny?variant=lenovo-thinkcentre-m73-tiny-i5-8gb-500gb');
  await redirectsTo('https://dobatron.com/shop?brand=HP', 'https://dobatron.co.ke/laptops?brand=HP');
  await redirectsTo('https://dobatron.com/guides/best-ex-uk-laptops-kenya-by-budget', 'https://dobatron.co.ke/guides/best-refurbished-laptops-kenya-by-budget');
});

test('paths with no equivalent go to the nearest existing page, homepage last; never a 404', async () => {
  await redirectsTo('https://dobatron.com/laptops/not-a-model', 'https://dobatron.co.ke/laptops');
  await redirectsTo('https://dobatron.com/guides/some-old-post', 'https://dobatron.co.ke/guides');
  await redirectsTo('https://dobatron.com/p/no-such-offer', 'https://dobatron.co.ke/');
  await redirectsTo('https://dobatron.com/old/page.html', 'https://dobatron.co.ke/');
});

test('robots.txt and sitemap.xml on .com redirect to the .co.ke files (which are 200 there)', async () => {
  await redirectsTo('https://dobatron.com/robots.txt', 'https://dobatron.co.ke/robots.txt');
  await redirectsTo('https://dobatron.com/sitemap.xml', 'https://dobatron.co.ke/sitemap.xml');
  assert.equal((await hit('https://dobatron.co.ke/robots.txt')).status, 200);
  assert.equal((await hit('https://dobatron.co.ke/sitemap.xml')).status, 200);
});

test('dobatron.co.ke: one canonical form (https, apex, no trailing slash); old paths map in one hop; unknown paths 404', async () => {
  assert.equal((await hit('https://dobatron.co.ke/laptops/hp-elitebook-840-g6')).status, 200);
  assert.equal((await hit('https://dobatron.co.ke/laptops/hp-elitebook-840-g6?variant=hp-elitebook-840-g6-i7-8gb-512gb')).status, 200);
  await redirectsTo('http://dobatron.co.ke/laptops', 'https://dobatron.co.ke/laptops');
  await redirectsTo('https://dobatron.co.ke/laptops/', 'https://dobatron.co.ke/laptops');
  await redirectsTo('http://www.dobatron.co.ke/guides/', 'https://dobatron.co.ke/guides');
  await redirectsTo('http://dobatron.co.ke/p/dell-latitude-5300-i5-8gb-256gb', 'https://dobatron.co.ke/laptops/dell-latitude-5300?variant=dell-latitude-5300-i5-8gb-256gb');
  assert.equal((await hit('https://dobatron.co.ke/laptops/not-a-model')).status, 404);
  assert.equal((await hit('https://dobatron.co.ke/laptops?brand=HP')).robots, 'noindex, follow');
  assert.equal((await hit('https://dobatron.co.ke/laptops')).robots, null);
});

test('other stores and Duka Bee itself are untouched', async () => {
  assert.equal((await hit('https://faithnjogu.dukabee.co.ke/')).status, 200);
  assert.equal((await hit('https://dukabee.co.ke/')).status, 200);
  await redirectsTo('https://dukabee.co.ke/stores/dobatron/laptops', 'https://dobatron.co.ke/laptops');
});
