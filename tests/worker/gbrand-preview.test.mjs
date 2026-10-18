// GBRAND client preview route: dukabee.co.ke/preview/gbrand-<id>. Runs worker/index.mjs in Node with cloudflare:workers shimmed
// and a fake ASSETS binding over a fresh preview build.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildGbrand } from '../../scripts/build-gbrand.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let worker, env, id, expiresAt;
before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrand-w-'));
  const dist = path.join(tmp, 'stores', 'gbrand-preview');
  await buildGbrand({ outDir: dist, preview: true });
  ({ id, expiresAt } = JSON.parse(fs.readFileSync(path.join(dist, '_preview.json'), 'utf8')));
  const shim = path.join(tmp, 'worker.mjs');
  fs.writeFileSync(shim, fs.readFileSync(path.join(ROOT, 'worker/index.mjs'), 'utf8').replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor() {} }').replace("from '../launch/addons.mjs'", `from '${pathToFileURL(path.join(ROOT, 'launch/addons.mjs')).href}'`));
  worker = (await import(pathToFileURL(shim).href)).default;
  env = { ASSETS: { fetch: async (req) => {
    const f = path.join(tmp, new URL(req.url).pathname);
    for (const c of [f, `${f}.html`, path.join(f, 'index.html')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return new Response(fs.readFileSync(c), { headers: { 'content-type': c.endsWith('.html') ? 'text/html' : c.endsWith('.json') ? 'application/json' : 'text/plain' } });
    return new Response('nf', { status: 404 });
  } } };
});
const get = (p) => worker.fetch(new Request(`https://dukabee.co.ke${p}`), env);

test('serves the store under its preview id, noindex, with the base baked into links', async () => {
  for (const p of [`/preview/${id}/`, `/preview/${id}/shop`, `/preview/${id}/product/barcelona-home`]) {
    const r = await get(p); assert.equal(r.status, 200, p); assert.match(r.headers.get('x-robots-tag'), /noindex/);
  }
  assert.match(await (await get(`/preview/${id}/shop`)).text(), new RegExp(`href="/preview/${id}/product/`));
  assert.equal((await get(`/preview/${id}`)).status, 301);
});
test('wrong id and the raw folder are 404; unknown page is the on-brand 404', async () => {
  assert.equal((await get('/preview/gbrand-wrongid12/')).status, 404);
  assert.equal((await get('/stores/gbrand-preview/index.html')).status, 404);
  const r = await get(`/preview/${id}/nope`); assert.equal(r.status, 404); assert.match(await r.text(), /Offside/);
});
test('expires at expiresAt with a 410', async () => {
  const real = Date.now;
  Date.now = () => Date.parse(expiresAt) + 60e3;
  try { assert.equal((await get(`/preview/${id}/`)).status, 410); } finally { Date.now = real; }
});
