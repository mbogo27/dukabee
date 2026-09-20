// Sections — composites of molecules. This is where styling and behaviour attach: data-* hooks here are
// what the runtime binds to (cart, checkout, selectors, filters). Atoms and molecules stay behaviour-free.
import { esc, el, div, button, heading, paragraph, list, listItem, link } from './atoms.mjs';
import { cta, statBlock, mediaFrame, productCard, attributeSelector, cartLineItemTemplate, ksh } from './molecules.mjs';

const routes = (base) => ({ home: `${base}index.html`, shop: `${base}shop.html`, product: (slug) => `${base}product/${slug}.html` });

// Logo (uploaded image or wordmark text). The image is decorative next to the name, so alt is empty.
const logoLink = ({ shop, href }) => link({ class: `kw-logo${shop.logoWide ? ' kw-logo--wide' : ''}`, href, ...(shop.logoWide ? { 'aria-label': shop.name } : {}) }, [
  shop.logo ? `<img class="kw-logo__img" src="${esc(shop.logo)}" alt="">` : '',
  shop.logoWide ? '' : `<span class="kw-logo__text">${esc(shop.wordmark)}</span>`,
]);

export const header = ({ shop, base, current }) => {
  const r = routes(base);
  return el('header', { class: 'kw-header' }, div({ class: 'kw-wrap kw-header__inner' }, [
    logoLink({ shop, href: r.home }),
    el('nav', { class: 'kw-nav', 'aria-label': 'Main' }, [
      link({ href: r.home, 'aria-current': current === 'home' ? 'page' : false }, 'Home'),
      link({ href: r.shop, 'data-shop-link': true, 'aria-current': current === 'shop' ? 'page' : false }, 'Shop'),
    ]),
    // Search matches product name + category; on the shop page it filters live, elsewhere it opens the shop.
    el('form', { class: 'kw-search', role: 'search', 'data-search-form': true }, [
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
      '<input type="search" name="q" placeholder="Search products" aria-label="Search products" autocomplete="off" enterkeyhint="search">',
    ]),
    button({ class: 'kw-cart-btn', 'data-cart-open': true, 'aria-label': 'Open cart' }, [
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 9V6a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      '<span class="kw-cart-btn__label">Cart</span>',
      el('span', { class: 'kw-badge', 'data-cart-count': true, hidden: true }, '0'),
    ]),
  ]));
};

const policyList = (policy) => policy ? [
  policy.items?.length ? list({ class: 'kw-policy' }, policy.items.map((t) => listItem({}, esc(t))).join('')) : '',
  policy.note ? paragraph({ class: 'kw-policy__note' }, esc(policy.note)) : '',
].join('') : '';

// Demo stores only: a floating bar that leads back to Duka Bee. Rendered with Duka Bee's own colours, not the
// store's, because it belongs to the platform rather than the shop. Real seller stores never get it.
export const demoBar = ({ href = '/' } = {}) => el('a', { class: 'kw-demobar', href, 'data-track': 'demobar_click', 'aria-label': 'Built with Duka Bee. Make your own store.' }, [
  '<img class="kw-demobar__bee" src="/brand/bee-256.png" width="26" height="26" alt="" onerror="this.remove()">',
  '<span class="kw-demobar__text"><b>Built with Duka Bee</b><span> · make your own store</span></span>',
  '<span class="kw-demobar__go" aria-hidden="true">Get started &rarr;</span>',
]);

export const footer = ({ shop, base }) => el('footer', { class: 'kw-footer' }, div({ class: 'kw-wrap kw-footer__inner' }, [
  div({}, [logoLink({ shop, href: `${base}index.html` }), paragraph({}, esc(shop.footer))]),
  div({ class: 'kw-footer__contact' }, [
    paragraph({ class: 'kw-footer__label' }, 'Order or ask a question'),
    link({ class: 'kw-footer__wa', href: `https://wa.me/${shop.whatsapp}`, target: '_blank', rel: 'noopener' }, `WhatsApp +${esc(shop.whatsapp)}`),
    shop.location ? div({ class: 'kw-footer__block' }, [paragraph({ class: 'kw-footer__label' }, 'Find us'), paragraph({}, esc(shop.location))]) : '',
    shop.payment ? div({ class: 'kw-footer__block' }, [paragraph({ class: 'kw-footer__label' }, 'Pay with'), paragraph({}, esc(shop.payment))]) : '',
    shop.policy ? div({ class: 'kw-footer__block' }, [paragraph({ class: 'kw-footer__label' }, 'Delivery & returns'), policyList(shop.policy)]) : '',
  ]),
  paragraph({ class: 'kw-footer__fine' }, `© ${esc(shop.name)} · Prices in KSh · Built with Duka Bee`),
]));

// Product grid: tiles 1…N cards with responsive reflow. `cap` turns it into the featured strip.
export const productGrid = ({ products, base, cap, id }) => {
  const items = cap ? products.slice(0, cap) : products;
  return el('div', { class: `kw-grid${cap ? ' kw-grid--strip' : ''}`, id, 'data-count': items.length, 'data-cols': cap ? Math.min(items.length, 5) : false },
    items.map((p) => productCard({ product: p, href: routes(base).product(p.slug), base })));
};

export const hero = ({ shop, products, base }) => {
  const img = shop.hero.images[0] || products[0].image;
  const copy = div({ class: 'kw-hero__copy' }, [
    paragraph({ class: 'kw-eyebrow' }, esc(shop.eyebrow)),
    heading(1, { class: 'kw-hero__title' }, esc(shop.hero.title)),
    paragraph({ class: 'kw-hero__body' }, esc(shop.hero.body)),
    div({ class: 'kw-hero__actions' }, [cta({ label: shop.hero.primary || 'Shop all products', href: routes(base).shop }), cta({ label: shop.hero.secondary || 'Order on WhatsApp', href: `https://wa.me/${shop.whatsapp}`, variant: 'ghost', attrs: { target: '_blank', rel: 'noopener' } })]),
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
  productGrid({ products, base, cap: Math.min(5, Math.max(4, shop.featuredCount)) }),
]));

// Filter control: reads only filterable attributes (facets), with a zero-result empty state.
export const filterControl = ({ facets, prices }) => el('aside', { class: 'kw-filters', 'data-filters': true }, el('details', { class: 'kw-filters__details', open: true }, [
  el('summary', {}, `Filter <span class="kw-filters__active" data-filter-active></span>`),
  ...facets.map((f) => el('fieldset', { class: 'kw-facet', 'data-facet': f.key }, [
    el('legend', {}, esc(f.label)),
    div({ class: `kw-facet__values${f.key === 'size' ? ' kw-facet__values--chips' : ''}` }, f.values.map((v) => el('label', { class: 'kw-check' }, [
      `<input type="checkbox" name="${esc(f.key)}" value="${esc(v.value)}">`,
      el('span', {}, esc(v.value)), el('small', {}, String(v.count)),
    ]))),
  ])),
  el('fieldset', { class: 'kw-facet', 'data-facet': '_price' }, [
    el('legend', {}, 'Price (KSh)'),
    div({ class: 'kw-price' }, [
      `<label><span>Min</span><input type="number" inputmode="numeric" min="0" name="min" data-price-min placeholder="${prices.min}"></label>`,
      `<label><span>Max</span><input type="number" inputmode="numeric" min="0" name="max" data-price-max placeholder="${prices.max}"></label>`,
    ]),
  ]),
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
    filterControl({ facets, prices: { min: Math.min(...products.map((p) => p.price)), max: Math.max(...products.map((p) => p.price)) } }),
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
export const productDetail = ({ product, base, shop }) => {
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
      product.priceNote ? paragraph({ class: 'kw-pdp__pricenote' }, esc(product.priceNote)) : '',
      div({ class: 'kw-desc', 'data-desc': true }, [div({ class: 'kw-desc__text' }, product.description.split(/\n+/).map((t) => paragraph({}, esc(t))).join('')), button({ class: 'kw-textlink kw-desc__toggle', 'data-desc-toggle': true, hidden: true }, 'Read more')]),
      ...selectable.map((a) => attributeSelector({ attribute: a, base })),
      paragraph({ class: 'kw-pdp__hint', 'data-pdp-hint': true, 'aria-live': 'polite' }, selectable.length ? `Choose ${selectable.map((a) => a.label.toLowerCase()).join(' and ')} to continue` : ''),
      // CTA set: Add to Cart and Buy Now share one mechanism; Buy Now also opens the cart at the checkout form.
      div({ class: 'kw-cta-set' }, [
        el('button', { class: 'kw-cta kw-cta--ghost', type: 'submit', value: 'add', 'data-add-to-cart': true, disabled: selectable.length > 0 }, 'Add to cart'),
        el('button', { class: 'kw-cta kw-cta--primary', type: 'submit', value: 'buy', 'data-buy-now': true, disabled: selectable.length > 0 }, 'Buy now'),
      ]),
      product.facts?.length ? el('dl', { class: 'kw-specs kw-specs--facts' }, product.facts.map((f) => div({}, [el('dt', {}, esc(f.label)), el('dd', {}, esc(f.value))])).join('')) : '',
      ...(product.sections || []).map((s) => el('details', { class: 'kw-more' }, [el('summary', {}, esc(s.title)), s.items ? el('ul', {}, s.items.map((i) => el('li', {}, esc(i))).join('')) : paragraph({}, esc(s.text))])),
      shop?.policy ? div({ class: 'kw-pdp__policy' }, [paragraph({ class: 'kw-pdp__policy-title' }, 'Delivery & returns'), policyList(shop.policy)]) : '',
      plain.length ? el('dl', { class: 'kw-specs' }, plain.map((a) => div({}, [el('dt', {}, esc(a.label)), el('dd', {}, esc(a.values.map((v) => v.value).join(', ')))])).join('')) : '',
    ]),
  ]));
};

// Booking variant of the pre-checkout form, for shops that sell sessions/programs instead of shipped goods.
// Cohort products (fixed dates) ask for date confirmation; always-open products ask when the client wants to start.
const bookingForm = ({ checkout }) => el('form', { class: 'kw-drawer__view kw-checkout', 'data-view': 'checkout', 'data-checkout-form': true, hidden: true }, [
  button({ class: 'kw-textlink', 'data-checkout-back': true }, '← Back'),
  heading(3, {}, 'Your booking details'),
  paragraph({ class: 'kw-fine' }, esc(checkout.intro)),
  el('label', {}, ['Your name', '<input name="customerName" required autocomplete="name" placeholder="e.g. Mary Wanjiku">']),
  el('label', {}, ['Partner\'s name <small>(if booking as a couple)</small>', '<input name="partnerName" placeholder="e.g. John Kamau">']),
  el('label', {}, ['Phone number', '<input name="phone" type="tel" inputmode="tel" required autocomplete="tel" placeholder="e.g. 0712 345 678">']),
  el('label', { class: 'kw-check', 'data-cohort-box': true, hidden: true }, ['<input type="checkbox" name="cohortOk">', '<span data-cohort-text></span>']),
  el('label', { 'data-start-box': true, hidden: true }, ['When would you like to start?', '<select name="startWhen"><option>As soon as possible</option><option>Next week</option><option>Let\'s discuss</option></select>']),
  el('label', {}, ['Notes <small>(optional)</small>', '<textarea name="notes" rows="2"></textarea>']),
  div({ class: 'kw-paybox' }, [el('strong', {}, 'Pay by M-Pesa'), paragraph({}, esc(checkout.payment)), paragraph({ class: 'kw-fine' }, esc(checkout.paymentNote))]),
  el('button', { class: 'kw-cta kw-cta--primary kw-cta--block', type: 'submit' }, esc(checkout.submit)),
]);

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
          paragraph({ class: 'kw-fine' }, shop.checkout ? 'You\'ll confirm your booking with a real person on WhatsApp.' : 'You\'ll confirm the order with a real person on WhatsApp.'),
        ]),
      ]),
      // Pre-checkout form (the Dobatron/Taskbee form): structures the order, then fires the WhatsApp message.
      shop.checkout ? bookingForm({ checkout: shop.checkout }) : el('form', { class: 'kw-drawer__view kw-checkout', 'data-view': 'checkout', 'data-checkout-form': true, hidden: true }, [
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
  shop.checkout ? `<script type="application/json" data-service>${JSON.stringify({ verb: shop.checkout.verb, greeting: shop.checkout.greeting, payment: shop.checkout.payment, cohorts: shop.checkout.cohorts || {} }).replace(/</g, '\\u003c')}</script>` : '',
  cartLineItemTemplate(),
  div({ class: 'kw-toast', 'data-toast': true, role: 'status', hidden: true }, ''),
].join('');

// ---- optional homepage sections, driven by shop.home (trust, tiles, testimonials, about, publish) ----
export const trustStrip = ({ trust }) => el('section', { class: 'kw-trust', 'aria-label': 'Why buy here' }, div({ class: 'kw-wrap kw-trust__inner' }, [
  list({ class: 'kw-trust__items' }, (trust.items || []).map((t) => listItem({}, ['<span class="kw-trust__tick" aria-hidden="true">✓</span>', esc(t)]))),
  trust.logos?.length ? div({ class: 'kw-trust__logos' }, [paragraph({ class: 'kw-trust__label' }, esc(trust.logosLabel || 'As seen on')), ...trust.logos.map((l) => `<img src="${esc(l.src)}" alt="${esc(l.alt)}" loading="lazy" height="34">`)]) : '',
]));

export const categoryTiles = ({ tiles, base, title = 'Shop by category' }) => el('section', { class: 'kw-section kw-tiles' }, div({ class: 'kw-wrap' }, [
  div({ class: 'kw-section__head' }, [heading(2, {}, esc(title))]),
  div({ class: 'kw-tiles__grid', 'data-count': tiles.length }, tiles.map((t) => link({ class: 'kw-tile', href: `${routes(base).shop}?category=${encodeURIComponent(t.label)}` }, [
    el('span', { class: 'kw-tile__name' }, esc(t.label)), el('span', { class: 'kw-tile__count' }, `${t.count} ${t.count === 1 ? 'item' : 'items'} →`),
  ]))),
]));

export const testimonials = ({ items, base }) => el('section', { class: 'kw-section kw-quotes' }, div({ class: 'kw-wrap' }, [
  div({ class: 'kw-section__head' }, [heading(2, {}, 'What clients say')]),
  div({ class: 'kw-quotes__grid' }, items.map((t) => el('figure', { class: 'kw-quote' }, [
    el('blockquote', {}, paragraph({}, `“${esc(t.quote)}”`)),
    el('figcaption', {}, [t.image ? `<img src="${esc(base + t.image)}" alt="" width="48" height="48" loading="lazy">` : '', el('span', {}, esc(t.name))]),
  ]))),
]));

export const aboutCta = ({ about, base }) => el('section', { class: 'kw-section kw-about' }, div({ class: 'kw-wrap kw-about__inner' }, [
  about.image ? mediaFrame({ src: base + about.image, alt: about.title }) : '',
  div({ class: 'kw-about__copy' }, [
    heading(2, {}, esc(about.title)),
    ...about.body.map((t) => paragraph({}, esc(t))),
    div({ class: 'kw-hero__actions' }, [cta({ label: about.cta.label, href: about.cta.external ? about.cta.href : `${base}${about.cta.href}`, attrs: about.cta.external ? { target: '_blank', rel: 'noopener' } : {} })]),
  ]),
]));

// Demo previews only: the closing section that turns the preview into the offer.
export const publishCta = ({ price, href = '/launch/' }) => el('section', { class: 'kw-publish' }, div({ class: 'kw-wrap kw-publish__inner' }, [
  div({}, [heading(2, {}, 'Like what you see?'), paragraph({}, `Customize this into your store. ${esc(price)} to launch, with your domain and hosting included.`)]),
  link({ class: 'kw-cta kw-cta--primary kw-publish__btn', href, 'data-track': 'publish_cta_click' }, `Customize &amp; publish · ${esc(price)}`),
]));
