// Assemble the deployable static site in dist/ (Cloudflare Pages):
//   /            landing page + launch form      (web/)
//   /store/      client-side generated stores     (web/store + lib/)
//   /demos/<id>/ Kladi, Jikoni, Rembo             (out/<id>/site)
//   /assets/     shared Kiwanda runtime
//   /lib/        Kiwanda composer + launch generator as browser ES modules
import fs from 'node:fs';
import path from 'node:path';
import { runPipeline, DEMOS, ROOT } from '../pipeline/run.mjs';

const DIST = path.join(ROOT, 'dist');
const cp = (from, to) => fs.cpSync(path.join(ROOT, from), path.join(DIST, to), { recursive: true });

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

cp('web', '.');
cp('kiwanda/runtime', 'assets');
for (const f of ['atoms.mjs', 'molecules.mjs', 'sections.mjs', 'templates.mjs', 'pages.mjs']) cp(`kiwanda/${f}`, `lib/kiwanda/${f}`);
for (const f of ['vault.mjs', 'contrast.mjs']) cp(`pipeline/${f}`, `lib/pipeline/${f}`);
cp('launch/dummy.mjs', 'lib/launch/dummy.mjs');

const showcase = [];
for (const demo of DEMOS) {
  const manifest = await runPipeline(demo);
  cp(`out/${demo}/site`, `demos/${demo}`);
  const shop = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', demo, 'vault', 'shop.json'), 'utf8'));
  const products = fs.readdirSync(path.join(ROOT, 'out', demo, 'vault', 'products')).map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'out', demo, 'vault', 'products', f), 'utf8')));
  showcase.push({
    id: demo, name: shop.name, vertical: manifest.vertical, tagline: shop.tagline,
    products: manifest.counts.products, pages: manifest.counts.pages,
    colors: ['paper', 'soft', 'accent', 'highlight', 'ink'].map((k) => shop.theme.color[k]),
    images: products.slice(0, 3).map((p) => `/demos/${demo}/${p.image}`),
  });
  console.log(`  ✓ ${demo}: ${manifest.counts.pages} pages`);
}
fs.writeFileSync(path.join(DIST, 'demos', 'demos.json'), JSON.stringify(showcase, null, 2));

// Short cache on HTML/modules so redeploys show up immediately; images can cache longer.
fs.writeFileSync(path.join(DIST, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/lib/*
  Cache-Control: public, max-age=300
/assets/*
  Cache-Control: public, max-age=300
/demos/*/images/*
  Cache-Control: public, max-age=604800
`);

const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
console.log(`dist/ ready — ${count(DIST)} files. Deploy: npx wrangler pages deploy dist --project-name dukabee`);
