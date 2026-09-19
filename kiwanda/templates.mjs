// Named page templates — sections arranged into layout, no live data. Header, footer and the cart
// overlay are reused across every template, never redeclared per template.
import { esc } from './atoms.mjs';
import { header, footer, cartOverlay, hero, featuredStrip, shopBody, productDetail, demoBar } from './sections.mjs';

const fontHref = (type) => {
  const fam = (name, weights) => `family=${name.replace(/ /g, '+')}:wght@${weights}`;
  const families = [fam(type.display, [...new Set([400, type.displayWeight])].sort().join(';'))];
  if (type.body !== type.display) families.push(fam(type.body, '400;500;700'));
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
};

// brand.md tokens → CSS custom properties. Everything visual that differs between shops lives here.
const themeCss = ({ color, type, shape }) => `:root{${Object.entries(color).map(([k, v]) => `--kw-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';')};--kw-font-display:'${type.display}',Georgia,serif;--kw-font-body:'${type.body}',system-ui,sans-serif;--kw-display-weight:${type.displayWeight};--kw-tracking:${type.tracking};--kw-radius:${shape.radius}}`;

const shell = ({ shop, base, title, description, current, body, demo }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="generator" content="Duka Bee · Kiwanda web mode">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontHref(shop.theme.type)}">
<link rel="stylesheet" href="${base}assets/kiwanda.css">
<style>${themeCss(shop.theme)}</style>
${demo ? '<script src="/analytics.js" async></script>\n' : ''}</head>
<body class="kw kw-card--${shop.theme.shape.card} kw-btn--${shop.theme.shape.button} kw-density--${shop.theme.shape.density} kw-page--${current}${demo ? ' kw-has-demobar' : ''}" data-base="${base}">
<a class="kw-skip" href="#main">Skip to content</a>
${header({ shop, base, current })}
<main id="main">${body}</main>
${footer({ shop, base })}
${cartOverlay({ shop, base })}
${demo ? demoBar(typeof demo === 'object' ? demo : {}) : ''}
<script src="${base}assets/kiwanda.js" defer></script>
</body>
</html>
`;

export const homeTemplate = ({ shop, products, base = '', demo }) => shell({
  shop, base, demo, current: 'home', title: `${shop.name} — ${shop.tagline}`, description: shop.hero.body,
  body: hero({ shop, products, base }) + featuredStrip({ shop, products, base }),
});

export const shopTemplate = ({ shop, products, facets, base = '', demo }) => shell({
  shop, base, demo, current: 'shop', title: `Shop · ${shop.name}`, description: `All ${products.length} products from ${shop.name}.`,
  body: shopBody({ products, facets, base }),
});

export const productTemplate = ({ shop, product, base = '../', demo }) => shell({
  shop, base, demo, current: 'product', title: `${product.name} · ${shop.name}`, description: product.description.slice(0, 150),
  body: productDetail({ product, base, shop }),
});
