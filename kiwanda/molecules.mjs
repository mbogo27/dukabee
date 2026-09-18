// Molecules — small atom groupings. Identical across fixed-canvas and web mode.
import { esc, el, div, button, heading, paragraph, image, link } from './atoms.mjs';

export const ksh = (n) => `KSh ${Number(n).toLocaleString('en-KE')}`;

// CTA = button + label. Rendered as a link when it navigates, a button when a section binds behaviour.
export const cta = ({ label, href, variant = 'primary', attrs = {} }) => href
  ? link({ class: `kw-cta kw-cta--${variant}`, href, ...attrs }, esc(label))
  : button({ class: `kw-cta kw-cta--${variant}`, ...attrs }, esc(label));

export const statBlock = ({ value, label }) => div({ class: 'kw-stat' }, [heading(3, { class: 'kw-stat__value' }, esc(value)), paragraph({ class: 'kw-stat__label' }, esc(label))]);

export const mediaFrame = ({ src, alt, caption, attrs = {}, eager = false }) => el('figure', { class: 'kw-media' }, [
  image({ src, alt, ...(eager ? { loading: 'eager' } : {}), ...attrs }),
  caption ? el('figcaption', {}, esc(caption)) : '',
]);

// Filter data lives on the card so the filter control can work on any N without re-rendering.
export const productCard = ({ product, href, base }) => {
  const category = product.attributes.find((a) => a.key === 'category')?.values[0]?.value;
  const needsChoice = product.attributes.some((a) => a.selectable);
  const filterData = Object.fromEntries(product.attributes.filter((a) => a.filterable)
    .map((a) => [`data-f-${a.key}`, a.values.map((v) => v.value).join('|')]));
  return el('article', { class: 'kw-card', 'data-product': product.slug, 'data-price': product.price, ...filterData }, [
    link({ class: 'kw-card__media', href, tabindex: '-1', 'aria-hidden': 'true' }, image({ src: base + product.image, alt: '' })),
    div({ class: 'kw-card__body' }, [
      category ? paragraph({ class: 'kw-card__eyebrow' }, esc(category)) : '',
      heading(3, { class: 'kw-card__title' }, link({ href }, esc(product.name))),
      paragraph({ class: 'kw-card__price' }, (needsChoice && hasPriceDelta(product) ? 'From ' : '') + ksh(product.price)),
      needsChoice
        ? cta({ label: 'Choose options', href, variant: 'ghost' })
        : div({ class: 'kw-card__ctas' }, [
          cta({ label: 'Add to cart', variant: 'ghost', attrs: { 'data-quick-add': product.slug, 'data-name': product.name, 'data-price': product.price, 'data-image': product.image } }),
          cta({ label: 'Buy now', variant: 'primary', attrs: { 'data-quick-add': product.slug, 'data-buy': true, 'data-name': product.name, 'data-price': product.price, 'data-image': product.image } }),
        ]),
    ]),
  ]);
};
const hasPriceDelta = (p) => p.attributes.some((a) => a.selectable && a.values.some((v) => v.priceDelta));

// Generic attribute-selector: label + set of options. Same molecule for size, colour, shade, capacity…
export const attributeSelector = ({ attribute, base }) => el('fieldset', { class: 'kw-selector', 'data-attr': attribute.key }, [
  el('legend', { class: 'kw-selector__label' }, `${esc(attribute.label)} <span class="kw-selector__chosen" data-chosen></span>`),
  div({ class: 'kw-selector__options' }, attribute.values.map((v) => el('label', { class: 'kw-option' }, [
    `<input type="radio" name="${esc(attribute.key)}" value="${esc(v.value)}"${v.priceDelta ? ` data-price-delta="${v.priceDelta}"` : ''}${v.image ? ` data-image="${esc(base + v.image)}" data-image-rel="${esc(v.image)}"` : ''}>`,
    el('span', {}, esc(v.value) + (v.priceDelta ? ` <small>+${ksh(v.priceDelta)}</small>` : '')),
  ]))),
]);

// Cart line item — image + heading + quantity + remove + selected attribute values.
// Emitted once as a <template>; the cart overlay section clones it per line on the client.
export const cartLineItemTemplate = () => el('template', { id: 'kw-cart-line' }, el('li', { class: 'kw-line' }, [
  image({ 'data-slot': 'image', alt: '' }),
  div({ class: 'kw-line__body' }, [
    heading(3, { class: 'kw-line__title', 'data-slot': 'name' }, ''),
    paragraph({ class: 'kw-line__attrs', 'data-slot': 'attrs' }, ''),
    div({ class: 'kw-line__row' }, [
      div({ class: 'kw-qty' }, [
        button({ 'data-act': 'dec', 'aria-label': 'Decrease quantity' }, '−'),
        el('output', { 'data-slot': 'qty' }, '1'),
        button({ 'data-act': 'inc', 'aria-label': 'Increase quantity' }, '+'),
      ]),
      el('strong', { 'data-slot': 'total' }, ''),
    ]),
    button({ class: 'kw-line__remove', 'data-act': 'remove' }, 'Remove'),
  ]),
]));
