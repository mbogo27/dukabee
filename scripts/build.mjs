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

// Empty dist/ rather than deleting it: on Windows a running `wrangler dev` keeps the folder open (EBUSY).
fs.mkdirSync(DIST, { recursive: true });
for (const e of fs.readdirSync(DIST)) fs.rmSync(path.join(DIST, e), { recursive: true, force: true });

cp('web', '.');
cp('kiwanda/runtime', 'assets');
for (const f of ['atoms.mjs', 'molecules.mjs', 'sections.mjs', 'templates.mjs', 'pages.mjs']) cp(`kiwanda/${f}`, `lib/kiwanda/${f}`);
for (const f of ['vault.mjs', 'contrast.mjs']) cp(`pipeline/${f}`, `lib/pipeline/${f}`);
for (const f of ['config.mjs', 'niches.mjs', 'brand.mjs', 'store.mjs', 'addons.mjs']) cp(`launch/${f}`, `lib/launch/${f}`);

// The landing-page showcase shows products only: no models or people. (Kladi's alphabetical first photo is a
// couple wearing the Ankara hoodie, so the picks are curated per demo. The big tile is the first pick.)
const SHOWCASE = {
  kladi: ['hooded-jacket-blue', 'berrykey-fleece-hoodie', 'quick-dry-hiking-shirt'],
  jikoni: ['cast-iron-skillet-set', 'gold-cookware-set-10', 'em-air-fryer-5l'],
  rembo: ['loreal-men-power-age-serum', 'maybelline-fit-me-foundation', 'nivea-uv-face-spf50'],
};
const showcasePicks = (demo, products) => {
  const picks = (SHOWCASE[demo] || []).map((slug) => products.find((p) => p.slug === slug)).filter(Boolean);
  return picks.length === 3 ? picks : products.slice(0, 3);
};

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
    images: showcasePicks(demo, products).map((p) => `/demos/${demo}/${p.image}`),
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
