// Structural acceptance checks over generated output (run after `npm run generate`).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DEMOS } from '../pipeline/run.mjs';

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.log(`  ✗ ${msg}`); } };

for (const demo of DEMOS) {
  const out = path.join(ROOT, 'out', demo);
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  const products = fs.readdirSync(path.join(out, 'vault', 'products')).map((f) => JSON.parse(fs.readFileSync(path.join(out, 'vault', 'products', f), 'utf8')));
  console.log(`▸ ${demo}: ${m.counts.pages} pages, ${products.length} products`);
  ok(m.counts.pages === products.length + 2, 'home + shop + one page per product');
  for (const page of m.pages) {
    const html = fs.readFileSync(path.join(out, 'site', page.path), 'utf8');
    ok(html.includes('class="kw-header"') && html.includes('class="kw-footer"'), `${page.path}: shared header/footer`);
    ok(html.includes('data-cart-open') && html.includes('data-cart ') && html.includes('data-checkout-form'), `${page.path}: cart icon + overlay + checkout form`);
    for (const src of html.matchAll(/src="([^"]+\.(?:jpg|png|webp|avif))"/g)) ok(fs.existsSync(path.join(out, 'site', path.dirname(page.path), src[1])), `${page.path}: image ${src[1]} exists`);
  }
  for (const p of products) {
    const html = fs.readFileSync(path.join(out, 'site', 'product', `${p.slug}.html`), 'utf8');
    const sel = p.attributes.filter((a) => a.selectable).length;
    ok((html.match(/class="kw-selector"/g) || []).length === sel, `${p.slug}: ${sel} selector(s)`);
    ok(/data-add-to-cart[^>]*disabled/.test(html) === sel > 0, `${p.slug}: Add to Cart disabled iff selectors present`);
  }
  const shop = fs.readFileSync(path.join(out, 'site', 'shop.html'), 'utf8');
  const facetKeys = [...shop.matchAll(/data-facet="([^"]+)"/g)].map((x) => x[1]);
  ok(facetKeys.join() === m.filterable.slice().sort((a, b) => (a === 'category' ? -1 : b === 'category' ? 1 : 0)).join(), `facets = filterable attributes (${facetKeys.join(', ')})`);
  ok(shop.includes('data-empty'), 'shop has zero-result empty state');
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
