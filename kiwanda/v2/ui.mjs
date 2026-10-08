// Storefront v2 molecules: ImageRef placeholders, the price tag, product cards and WhatsApp links.
// Pure HTML strings like the rest of Kiwanda; behaviour hooks are data-* attributes bound by runtime/storefront.js.
import { esc, el } from '../atoms.mjs';
import { formatKsh, attr1 } from './catalog.mjs';

export { esc, el };
export const routes = {
  home: '/', shop: '/shop', guides: '/guides',
  product: (slug) => `/p/${slug}`,
  guide: (slug) => `/guides/${slug}`,
};
export const waHref = (number, text) => `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
export const jsonScript = (id, data, type = 'application/json') => `<script type="${type}"${id ? ` id="${id}"` : ''}>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/** An ImageRef: the photo when `src` is set, else the tint + glyph placeholder. Swapping in photos is data-only. */
export function imageRef(img, { cls = '', eager = false, alt } = {}) {
  const label = alt ?? img?.alt ?? '';
  if (img?.src) {
    const focal = img.focal ? ` style="object-position:${img.focal[0] * 100}% ${img.focal[1] * 100}%"` : '';
    return `<img class="sf-img ${cls}" src="${esc(img.src)}" alt="${esc(label)}"${focal} loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
  }
  const tint = img?.placeholder?.tint || '#E8E6E1';
  return `<div class="sf-ph ${cls}" role="img" aria-label="${esc(label)}" style="--tint:${esc(tint)}"><span aria-hidden="true">${esc(img?.placeholder?.glyph || '')}</span></div>`;
}

/** Price tag: yellow block, ink mono digits, small "KSh". Out of stock: greyed, "Last listed at". */
export function priceTag(price, { out = false, size = '' } = {}) {
  const digits = Math.round(price).toLocaleString('en-KE');
  return out
    ? `<span class="sf-price sf-price--out ${size}"><span class="sf-price__note">Last listed at</span> <small>KSh</small>${digits}</span>`
    : `<span class="sf-price ${size}"><small>KSh</small>${digits}</span>`;
}

/** Model name and configuration line, split from the importer's "{model} · {cpu}, {ram}/{storage}[, …]" name. */
export function nameParts(p, model) {
  const [head, config = ''] = p.name.split(' · ');
  return { title: model?.name || head, config };
}
/** "Core i5 8th Gen, 8GB/256GB, Touch" → "Core i5 8th Gen · 8GB RAM · 256GB · Touch" */
export const configLine = (config) => config.split(', ').map((part) => part.replace(/^(\d+GB)\/(.+)$/, '$1 RAM · $2')).join(' · ');

export const cartData = (p) => ({ 'data-add': p.slug, 'data-name': p.name, 'data-price': p.price });

/** Product card used by the shop grid, rails and showcases. The whole card links to the product page. */
export function productCard(p, { model, eager = false, headingLevel = 3, attrs = {} } = {}) {
  const { title, config } = nameParts(p, model);
  const out = p.stock === 'out';
  return el('article', { class: `sf-card${out ? ' is-out' : ''}`, 'data-slug': p.slug, ...attrs }, [
    `<a class="sf-card__link" href="${routes.product(p.slug)}">`,
    imageRef(p.images?.[0], { cls: 'sf-card__img', eager, alt: title }),
    `<div class="sf-card__body">`,
    `<span class="sf-card__eyebrow">${esc([attr1(p, 'brand'), attr1(p, 'formFactor') !== 'Clamshell' ? attr1(p, 'formFactor') : null].filter(Boolean).join(' · '))}</span>`,
    `<h${headingLevel} class="sf-card__title">${esc(title)}</h${headingLevel}>`,
    config ? `<span class="sf-card__config">${esc(configLine(config))}</span>` : '',
    `<span class="sf-card__foot">${priceTag(p.price, { out })}${out ? '<span class="sf-badge">Out of stock</span>' : ''}</span>`,
    `</div></a>`,
  ]);
}

export const ksh = formatKsh;
