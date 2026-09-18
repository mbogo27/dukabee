// Pages — templates populated with vault data: homepage, shop, one product page per product entity.
// Pure function of the vault: no editor step, so it runs headless.
import { homeTemplate, shopTemplate, productTemplate } from './templates.mjs';
import { facetsFor } from '../pipeline/vault.mjs';

export function composeSite({ shop, products }, { base = '', productBase = '../' } = {}) {
  if (!products.length) throw new Error(`${shop.name}: vault has no products`);
  const facets = facetsFor(products);
  return {
    facets,
    pages: [
      { path: 'index.html', kind: 'home', html: homeTemplate({ shop, products, base }) },
      { path: 'shop.html', kind: 'shop', html: shopTemplate({ shop, products, facets, base }) },
      ...products.map((product) => ({ path: `product/${product.slug}.html`, kind: 'product', slug: product.slug, html: productTemplate({ shop, product, base: productBase }) })),
    ],
  };
}
