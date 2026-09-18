// Sections — composites of molecules. This is where styling and behaviour attach: data-* hooks here are
// what the runtime binds to (cart, checkout, selectors, filters). Atoms and molecules stay behaviour-free.
import { esc, el, div, button, heading, paragraph, list, listItem, link } from './atoms.mjs';
import { cta, statBlock, mediaFrame, productCard, attributeSelector, cartLineItemTemplate, ksh } from './molecules.mjs';

const routes = (base) => ({ home: `${base}index.html`, shop: `${base}shop.html`, product: (slug) => `${base}product/${slug}.html` });

export const header = ({ shop, base, current }) => {
  const r = routes(base);
  return el('header', { class: 'kw-header' }, div({ class: 'kw-wrap kw-header__inner' }, [
    link({ class: 'kw-logo', href: r.home }, esc(shop.wordmark)),
    el('nav', { class: 'kw-nav', 'aria-label': 'Main' }, [
      link({ href: r.home, 'aria-current': current === 'home' ? 'page' : false }, 'Home'),
      link({ href: r.shop, 'aria-current': current === 'shop' ? 'page' : false }, 'Shop'),
    ]),
    button({ class: 'kw-cart-btn', 'data-cart-open': true, 'aria-label': 'Open cart' }, [
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 9V6a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      '<span class="kw-cart-btn__label">Cart</span>',
      el('span', { class: 'kw-badge', 'data-cart-count': true, hidden: true }, '0'),
    ]),
  ]));
};

export const footer = ({ shop, base }) => el('footer', { class: 'kw-footer' }, div({ class: 'kw-wrap kw-footer__inner' }, [
  div({}, [link({ class: 'kw-logo', href: `${base}index.html` }, esc(shop.wordmark)), paragraph({}, esc(shop.footer))]),
  div({ class: 'kw-footer__contact' }, [
    paragraph({ class: 'kw-footer__label' }, 'Order or ask a question'),
    link({ class: 'kw-footer__wa', href: `https://wa.me/${shop.whatsapp}`, target: '_blank', rel: 'noopener' }, `WhatsApp +${esc(shop.whatsapp)}`),
  ]),
  paragraph({ class: 'kw-footer__fine' }, `© ${esc(shop.name)} · Prices in KSh · Built with Duka Bee`),
]));

// Product grid: tiles 1…N cards with responsive reflow. `cap` turns it into the featured strip.
export const productGrid = ({ products, base, cap, id }) => {
  const items = cap ? products.slice(0, cap) : products;
  return el('div', { class: `kw-grid${cap ? ' kw-grid--strip' : ''}`, id, 'data-count': items.length },
    items.map((p) => productCard({ product: p, href: routes(base).product(p.slug), base })));
};

export const hero = ({ shop, products, base }) => {
  const img = shop.hero.images[0] || products[0].image;
  const copy = div({ class: 'kw-hero__copy' }, [
    paragraph({ class: 'kw-eyebrow' }, esc(shop.eyebrow)),
    heading(1, { class: 'kw-hero__title' }, esc(shop.hero.title)),
    paragraph({ class: 'kw-hero__body' }, esc(shop.hero.body)),
    div({ class: 'kw-hero__actions' }, [cta({ label: 'Shop all products', href: routes(base).shop }), cta({ label: 'Order on WhatsApp', href: `https://wa.me/${shop.whatsapp}`, variant: 'ghost', attrs: { target: '_blank', rel: 'noopener' } })]),
  ]);
  if (shop.hero.variant === 'hero-photo-stat') {
    const categories = new Set(products.map((p) => p.attributes.find((a) => a.key === 'category')?.values[0]?.value));
    const from = Math.min(...products.map((p) => p.price));
    return el('section', { class: 'kw-hero kw-hero--stat' }, [
      mediaFrame({ src: base + img, alt: '', eager: true }),
      div({ class: 'kw-wrap kw-hero__panel' }, [copy, div({ class: 'kw-hero__stats' }, [
        statBlock({ value: String(products.length), label: 'products' }),
        statBlock({ value: String(categories.size), label: 'categories' }),
        statBlock({ value: ksh(from), label: 'starting price' }),
      ])]),
    ]);
  }
  return el('section', { class: 'kw-hero kw-hero--photo' }, div({ class: 'kw-wrap kw-hero__inner' }, [copy, mediaFrame({ src: base + img, alt: '', eager: true })]));
};

export const featuredStrip = ({ shop, products, base }) => el('section', { class: 'kw-section' }, div({ class: 'kw-wrap' }, [
  div({ class: 'kw-section__head' }, [heading(2, {}, 'Featured'), link({ class: 'kw-textlink', href: routes(base).shop }, `See all ${products.length} →`)]),
  productGrid({ products, base, cap: Math.min(6, Math.max(4, shop.featuredCount)) }),
]));

// Filter control: reads only filterable attributes (facets), with a zero-result empty state.
export const filterControl = ({ facets }) => el('aside', { class: 'kw-filters', 'data-filters': true }, el('details', { class: 'kw-filters__details', open: true }, [
  el('summary', {}, `Filter <span class="kw-filters__active" data-filter-active></span>`),
  ...facets.map((f) => el('fieldset', { class: 'kw-facet', 'data-facet': f.key }, [
    el('legend', {}, esc(f.label)),
    div({ class: `kw-facet__values${f.key === 'size' ? ' kw-facet__values--chips' : ''}` }, f.values.map((v) => el('label', { class: 'kw-check' }, [
      `<input type="checkbox" name="${esc(f.key)}" value="${esc(v.value)}">`,
      el('span', {}, esc(v.value)), el('small', {}, String(v.count)),
    ]))),
  ])),
  button({ class: 'kw-textlink', 'data-filter-clear': true }, 'Clear all filters'),
]));

export const shopBody = ({ products, facets, base }) => el('section', { class: 'kw-section kw-section--shop' }, div({ class: 'kw-wrap' }, [
  div({ class: 'kw-section__head' }, [
    heading(1, { class: 'kw-page-title' }, 'Shop'),
    div({ class: 'kw-shop-tools' }, [
      paragraph({ class: 'kw-result-count', 'data-result-count': true, 'aria-live': 'polite' }, `${products.length} products`),
      el('label', { class: 'kw-sort' }, ['Sort ', el('select', { 'data-sort': true }, [
        el('option', { value: 'featured' }, 'Featured'), el('option', { value: 'price-asc' }, 'Price: low to high'), el('option', { value: 'price-desc' }, 'Price: high to low'),
      ])]),
    ]),
  ]),
  div({ class: 'kw-shop-layout' }, [
    filterControl({ facets }),
    div({}, [
      productGrid({ products, base, id: 'kw-shop-grid' }),
      div({ class: 'kw-empty', 'data-empty': true, hidden: true }, [
        heading(2, {}, 'Nothing matches those filters'),
        paragraph({}, 'Try removing a filter, or clear them all to see every product.'),
        button({ class: 'kw-cta kw-cta--primary', 'data-filter-clear': true }, 'Clear filters'),
      ]),
    ]),
  ]),
]));

// Product detail: image + text zone. One selector per selectable attribute; the rest render as text.
export const productDetail = ({ product, base }) => {
  const selectable = product.attributes.filter((a) => a.selectable);
  const plain = product.attributes.filter((a) => !a.selectable);
  const category = product.attributes.find((a) => a.key === 'category')?.values[0]?.value;
  const r = routes(base);
  return el('section', { class: 'kw-section kw-pdp' }, div({ class: 'kw-wrap kw-pdp__inner' }, [
    mediaFrame({ src: base + product.image, alt: product.name, eager: true, attrs: { 'data-pdp-image': true } }),
    el('form', {
      class: 'kw-pdp__info', 'data-pdp': product.slug, 'data-name': product.name, 'data-price': product.price, 'data-image': product.image, novalidate: true,
    }, [
      el('nav', { class: 'kw-crumbs', 'aria-label': 'Breadcrumb' }, [link({ href: r.shop }, 'Shop'), category ? ` / ${link({ href: `${r.shop}?category=${encodeURIComponent(category)}` }, esc(category))}` : '']),
      heading(1, { class: 'kw-pdp__title' }, esc(product.name)),
      paragraph({ class: 'kw-pdp__price', 'data-pdp-price': true }, ksh(product.price)),
      div({ class: 'kw-desc', 'data-desc': true }, [div({ class: 'kw-desc__text' }, product.description.split(/\n+/).map((t) => paragraph({}, esc(t))).join('')), button({ class: 'kw-textlink kw-desc__toggle', 'data-desc-toggle': true, hidden: true }, 'Read more')]),
      ...selectable.map((a) => attributeSelector({ attribute: a, base })),
      paragraph({ class: 'kw-pdp__hint', 'data-pdp-hint': true, 'aria-live': 'polite' }, selectable.length ? `Choose ${selectable.map((a) => a.label.toLowerCase()).join(' and ')} to continue` : ''),
      // CTA set: Add to Cart and Buy Now share one mechanism; Buy Now also opens the cart at the checkout form.
      div({ class: 'kw-cta-set' }, [
        el('button', { class: 'kw-cta kw-cta--ghost', type: 'submit', value: 'add', 'data-add-to-cart': true, disabled: selectable.length > 0 }, 'Add to cart'),
        el('button', { class: 'kw-cta kw-cta--primary', type: 'submit', value: 'buy', 'data-buy-now': true, disabled: selectable.length > 0 }, 'Buy now'),
      ]),
      plain.length ? el('dl', { class: 'kw-specs' }, plain.map((a) => div({}, [el('dt', {}, esc(a.label)), el('dd', {}, esc(a.values.map((v) => v.value).join(', ')))])).join('')) : '',
    ]),
  ]));
};

// Cart + checkout overlay — present on every page, opened from the header cart icon.
export const cartOverlay = ({ shop, base }) => [
  el('div', { class: 'kw-overlay', 'data-cart': true, hidden: true, 'data-shop': shop.id, 'data-shop-name': shop.name, 'data-whatsapp': shop.whatsapp }, [
    div({ class: 'kw-overlay__scrim', 'data-cart-close': true }),
    el('aside', { class: 'kw-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'kw-cart-title' }, [
      div({ class: 'kw-drawer__head' }, [heading(2, { id: 'kw-cart-title' }, 'Your cart'), button({ class: 'kw-close', 'data-cart-close': true, 'aria-label': 'Close cart' }, '×')]),
      div({ class: 'kw-drawer__view', 'data-view': 'cart' }, [
        list({ class: 'kw-lines', 'data-lines': true }, ''),
        div({ class: 'kw-cart-empty', 'data-cart-empty': true }, [paragraph({}, 'Your cart is empty.'), cta({ label: 'Browse the shop', href: routes(base).shop, variant: 'ghost' })]),
        div({ class: 'kw-drawer__foot', 'data-cart-foot': true }, [
          div({ class: 'kw-total' }, ['<span>Total</span>', el('strong', { 'data-cart-total': true }, 'KSh 0')]),
          button({ class: 'kw-cta kw-cta--primary kw-cta--block', 'data-checkout-open': true }, 'Checkout'),
          paragraph({ class: 'kw-fine' }, 'You\'ll confirm the order with a real person on WhatsApp.'),
        ]),
      ]),
      // Pre-checkout form (the Dobatron/Taskbee form): structures the order, then fires the WhatsApp message.
      el('form', { class: 'kw-drawer__view kw-checkout', 'data-view': 'checkout', 'data-checkout-form': true, hidden: true }, [
        button({ class: 'kw-textlink', 'data-checkout-back': true }, '← Back to cart'),
        heading(3, {}, 'Send the useful details first'),
        paragraph({ class: 'kw-fine' }, 'Give the shop enough detail to reply clearly on WhatsApp.'),
        el('label', {}, ['Your name', '<input name="customerName" required autocomplete="name" placeholder="e.g. Mary Wanjiku">']),
        el('label', {}, ['Delivery area', '<input name="deliveryArea" required placeholder="e.g. Westlands, Rongai, Thika, Kisumu">']),
        el('label', {}, ['Preferred delivery', '<select name="preferredDelivery"><option>Today</option><option>This week</option><option>Let\'s discuss</option></select>']),
        el('label', {}, ['Notes <small>(optional)</small>', '<textarea name="notes" rows="2"></textarea>']),
        el('button', { class: 'kw-cta kw-cta--primary kw-cta--block', type: 'submit' }, 'Continue to WhatsApp ↗'),
      ]),
    ]),
  ]),
  cartLineItemTemplate(),
  div({ class: 'kw-toast', 'data-toast': true, role: 'status', hidden: true }, ''),
].join('');
