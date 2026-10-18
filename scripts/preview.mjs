// Serve dist/ locally the way Cloudflare will (directory → index.html, /shop → shop.html).
//   npm run preview                 → whole site at http://localhost:8788
//   npm run preview -- --store dobatron → that store as the site root, as on its subdomain
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

const resolveIn = (DIST, pathname) => {
  let file = path.join(DIST, decodeURIComponent(pathname));
  if (!file.startsWith(DIST)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  if (fs.existsSync(`${file}.html`)) return `${file}.html`;
  if (fs.existsSync(path.join(file, 'index.html'))) return path.join(file, 'index.html');
  return null;
};

/** Serve a directory as a site root. Returns the http.Server (call .close() when done). */
export const serve = (root, port, BASE = '') => { const DIST = path.resolve(root); return http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  // --base /preview/<id>: serve the store under its preview path, as the worker does on dukabee.co.ke.
  if (BASE) { if (url.pathname === BASE || url.pathname.startsWith(`${BASE}/`)) url.pathname = url.pathname.slice(BASE.length) || '/'; else { res.writeHead(404); return res.end('Not found'); } }
  // Permanent redirects listed by the build (legacy /p/… and /shop URLs, renamed guides), as the worker serves them.
  const redirectsFile = path.join(DIST, 'redirects.json');
  const redirects = fs.existsSync(redirectsFile) ? JSON.parse(fs.readFileSync(redirectsFile, 'utf8')) : {};
  const to = redirects[url.pathname.replace(/\/$/, '') || '/'];
  if (to) {
    const target = to.includes('?') || !url.search ? to : `${to}${url.search}`;
    res.writeHead(301, { location: target });
    return res.end();
  }
  const file = resolveIn(DIST, url.pathname);
  const notFound = path.join(DIST, '404.html');
  if (!file) {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    return fs.existsSync(notFound) ? fs.createReadStream(notFound).pipe(res) : res.end('Not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port); };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const store = args.includes('--store') ? args[args.indexOf('--store') + 1] : null;
  const PORT = Number(process.env.PORT) || 8788;
  const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : '';
  serve(path.resolve('dist', ...(store ? ['stores', store] : [])), PORT, base);
  console.log(`dist${store ? `/stores/${store}` : ''} preview → http://localhost:${PORT}${base}/`);
}
