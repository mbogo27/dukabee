// Duka Bee Studio server — zero dependencies. Serves the studio UI, streams pipeline runs over SSE,
// exposes generated artifacts, and serves each generated site under /sites/<demo>/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { runPipeline, DEMOS, VERTICALS, ROOT } from './pipeline/run.mjs';

const PORT = Number(process.env.PORT) || 4321;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' };

const send = (res, code, body, type = 'text/plain; charset=utf-8') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
const json = (res, data, code = 200) => send(res, code, JSON.stringify(data), 'application/json');

function serveFile(res, root, rel) {
  const file = path.resolve(root, '.' + path.posix.normalize('/' + decodeURIComponent(rel)));
  if (!file.startsWith(path.resolve(root))) return send(res, 403, 'Forbidden');
  const target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  if (!fs.existsSync(target)) return send(res, 404, 'Not found');
  res.writeHead(200, { 'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(target).pipe(res);
}

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);

function demoSummary(demo) {
  const mapping = readJson(path.join(ROOT, 'out', demo, 'manifest.json'));
  const source = readJson(path.join(ROOT, 'sources', demo, 'source.json'));
  return {
    id: demo,
    name: source?.store.name || demo,
    vertical: VERTICALS[demo],
    descriptor: source?.store.descriptor,
    sourceProducts: source?.products.length || 0,
    imported: !!source,
    manifest: mapping,
  };
}

let running = false;

async function generate(req, res, url) {
  const which = url.searchParams.get('demo') || 'all';
  const pace = Number(url.searchParams.get('pace') ?? 220);
  const demos = which === 'all' ? DEMOS : [which];
  if (!demos.every((d) => DEMOS.includes(d))) return json(res, { error: 'unknown demo' }, 400);
  if (running) return json(res, { error: 'A generation is already running' }, 409);
  running = true;
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
  const emit = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  try {
    for (const demo of demos) {
      emit({ type: 'begin', demo });
      await runPipeline(demo, { pace, onEvent: (e) => emit({ ...e, demo }) });
    }
    emit({ type: 'end' });
  } catch (err) {
    emit({ type: 'error', message: err.message });
  } finally {
    running = false;
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if (p === '/' || p === '/index.html') return serveFile(res, path.join(ROOT, 'studio'), 'index.html');
    if (p.startsWith('/studio/')) return serveFile(res, path.join(ROOT, 'studio'), p.slice(8));
    if (p === '/api/demos') return json(res, DEMOS.map(demoSummary));
    if (p === '/api/generate') return generate(req, res, url);
    let m;
    if ((m = p.match(/^\/api\/artifact\/(\w+)\/(brand\.md|findings\.md|manifest\.json)$/)) && DEMOS.includes(m[1])) return serveFile(res, path.join(ROOT, 'out', m[1]), m[2]);
    if ((m = p.match(/^\/api\/vault\/(\w+)$/)) && DEMOS.includes(m[1])) {
      const dir = path.join(ROOT, 'out', m[1], 'vault');
      if (!fs.existsSync(dir)) return json(res, { error: 'not generated' }, 404);
      const products = fs.readdirSync(path.join(dir, 'products')).map((f) => readJson(path.join(dir, 'products', f)));
      return json(res, { shop: readJson(path.join(dir, 'shop.json')), products });
    }
    if ((m = p.match(/^\/sites\/(\w+)(\/.*)?$/)) && DEMOS.includes(m[1])) {
      if (!m[2]) { res.writeHead(302, { location: `/sites/${m[1]}/` }); return res.end(); }
      return serveFile(res, path.join(ROOT, 'out', m[1], 'site'), m[2]);
    }
    send(res, 404, 'Not found');
  } catch (err) {
    send(res, 500, err.stack);
  }
});

server.listen(PORT, () => console.log(`Duka Bee Studio → http://localhost:${PORT}`));
