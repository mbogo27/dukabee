// Storefront v2 sections: page chrome (announcement, header, footer, cart + checkout) and one renderer per homepage
// section type in the closed vocabulary. Each renderer receives a section already resolved by composeHomepage.
import { esc, el, routes, waHref, imageRef, priceTag, productCard, nameParts, configLine, fill } from './ui.mjs';
import { formatKsh } from './catalog.mjs';

const head = (title, link) => `<div class="sf-section__head"><h2>${esc(title)}</h2>${link || ''}</div>`;
const seeAll = (href, n, what) => (href ? `<a class="sf-textlink" href="${esc(href)}">See all${n ? ` ${n}` : ''}<span class="sf-sr"> ${esc(what || '')}</span> →</a>` : '');
const wrapSection = (type, variant, inner, extra = '') => `<section class="sf-section sf-${type} sf-${type}--${variant}" data-section="${type}"${extra}><div class="sf-wrap">${inner}</div></section>`;

// ---- chrome ----
export const announcement = (text) => `<div class="sf-announce" data-section="announcement"><div class="sf-wrap"><p>${esc(text)}</p></div></div>`;

/** The store's logo image (store.brand.logo / logoOnDark), or the text wordmark when a store has none. */
const logoMark = (store, { dark = false, eager = false } = {}) => {
  const img = dark ? store.brand?.logoOnDark || store.brand?.logo : store.brand?.logo;
  return img
    ? `<img class="sf-logo__img" src="${esc(img.src)}" alt="${esc(img.alt || store.name)}" width="${img.width}" height="${img.height}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`
    : `<span class="sf-logo__tag" aria-hidden="true"></span>${esc(store.name)}`;
};

/** nav: [{ href, label, key }]; the main nav grows with the store's categories (never "laptops only"). */
export function header({ store, current, nav = [{ href: routes.shop, label: 'Shop', key: 'shop' }, { href: routes.guides, label: 'Guides', key: 'guides' }], search = { action: routes.shop, label: 'products' } }) {
  const link = (n) => `<a href="${esc(n.href)}"${current === n.key ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
  return `<header class="sf-header"><div class="sf-wrap sf-header__inner">
<a class="sf-logo${store.brand?.logo ? ' sf-logo--image' : ''}" href="/" aria-label="${esc(store.name)} home">${logoMark(store, { eager: true })}</a>
<nav class="sf-nav" aria-label="Main">${nav.map(link).join('')}</nav>
<form class="sf-search" role="search" action="${esc(search.action)}" method="get" data-search-form>
<label class="sf-sr" for="sf-q">Search ${esc(search.label)}</label>
<input id="sf-q" type="search" name="q" placeholder="Search: 840 G6, ThinkPad, 16GB…" autocomplete="off" enterkeyhint="search">
<button type="submit" aria-label="Search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
</form>
<button class="sf-cartbtn" type="button" data-cart-open aria-label="Open cart"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 9V6a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span class="sf-cartbtn__label">Cart</span><span class="sf-cartbtn__count" data-cart-count hidden>0</span></button>
</div></header>`;
}

/** columns: [{ title, links: [{ href, label }] }]; without it, the legacy Shop/Guides columns render. */
export function footer({ store, categories, guides, columns }) {
  const tel = `+${store.whatsapp}`;
  if (columns) {
    return `<footer class="sf-footer" data-section="footer"><div class="sf-wrap sf-footer__inner">
<div class="sf-footer__brand"><a class="sf-logo sf-logo--footer${store.brand?.logo ? ' sf-logo--image' : ''}" href="/" aria-label="${esc(store.name)} home">${logoMark(store, { dark: true })}</a><p>${esc(store.footerBlurb || '')}</p>
<ul><li><a href="${waHref(store.whatsapp, `Hi ${store.name}, `)}" target="_blank" rel="noopener">WhatsApp ${esc(store.phoneDisplay)}</a></li><li><a href="tel:${tel}">Call ${esc(store.phoneDisplay)}</a></li></ul></div>
${columns.map((c) => `<div><h2 class="sf-footer__h">${esc(c.title)}</h2><ul>${c.links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul></div>`).join('\n')}
</div><div class="sf-wrap sf-footer__fine"><p>© ${new Date().getFullYear()} ${esc(store.name)} · Prices in KSh</p>${store.poweredBy ? `<p><a href="${esc(store.poweredBy.href)}">${esc(store.poweredBy.label)}</a></p>` : ''}</div></footer>`;
  }
  return `<footer class="sf-footer" data-section="footer"><div class="sf-wrap sf-footer__inner">
<div class="sf-footer__brand"><a class="sf-logo sf-logo--footer" href="/"><span class="sf-logo__tag" aria-hidden="true"></span>${esc(store.name)}</a><p>${esc(store.footerBlurb || '')}</p></div>
<div><h2 class="sf-footer__h">Contact</h2><ul>
<li><a href="${waHref(store.whatsapp, `Hi ${store.name}, `)}" target="_blank" rel="noopener">WhatsApp ${esc(store.phoneDisplay)}</a></li>
<li><a href="tel:${tel}">Call ${esc(store.phoneDisplay)}</a></li>
${(store.policies || []).map((p) => `<li>${esc(p)}</li>`).join('')}
</ul></div>
<div><h2 class="sf-footer__h">Shop</h2><ul>${categories.map((c) => `<li><a href="/shop?category=${encodeURIComponent(c.id)}">${esc(c.name)}</a></li>`).join('')}<li><a href="/shop">All ${esc(store.nouns?.many || 'products')}</a></li></ul></div>
<div><h2 class="sf-footer__h">Guides</h2><ul>${guides.map((g) => `<li><a href="${routes.guide(g.slug)}">${esc(g.title)}</a></li>`).join('')}<li><a href="/guides">All guides</a></li></ul></div>
</div><div class="sf-wrap sf-footer__fine"><p>© ${new Date().getFullYear()} ${esc(store.name)} · Prices in KSh</p>${store.poweredBy ? `<p><a href="${esc(store.poweredBy.href)}">${esc(store.poweredBy.label)}</a></p>` : ''}</div></footer>`;
}

/** Pre-checkout field library (v2 Phase 4). Fulfilment options follow confirmed policies; with neither a delivery
 *  nor a pickup policy confirmed, both show and pickup is agreed on WhatsApp. */
export function checkoutForm({ store }) {
  const co = store.checkout || {};
  const fields = co.fields || ['name', 'fulfilment', 'deliveryArea', 'pickupPoint', 'paymentMethod', 'notes'];
  const pol = (store.policies || []).join(' ').toLowerCase();
  const hasDelivery = /deliver/.test(pol), hasPickup = /pickup|pick-up|collect/.test(pol);
  const showDelivery = hasDelivery || !hasPickup, showPickup = hasPickup || !hasDelivery;
  const points = co.pickupPoints || [];
  const pickupLabel = points.length ? 'Pickup' : (co.pickupFallback || 'Pickup');
  const methods = co.paymentMethods?.length ? co.paymentMethods : ['M-Pesa'];
  const parts = [];
  for (const f of fields) {
    if (f === 'name') parts.push(`<label class="sf-field">Your name<input name="name" required autocomplete="name" placeholder="e.g. Mary Wanjiku"></label>`);
    if (f === 'fulfilment') parts.push(`<fieldset class="sf-field sf-field--choice"><legend>Delivery or pickup</legend>${showDelivery ? `<label class="sf-choice"><input type="radio" name="fulfilment" value="delivery" required${showPickup ? '' : ' checked'}><span>Delivery</span></label>` : ''}${showPickup ? `<label class="sf-choice"><input type="radio" name="fulfilment" value="pickup" required${showDelivery ? '' : ' checked'}><span>${esc(pickupLabel)}</span></label>` : ''}</fieldset>`);
    if (f === 'deliveryArea' && showDelivery) parts.push(`<label class="sf-field" data-when="delivery" hidden>Delivery area<input name="deliveryArea" placeholder="e.g. Westlands, Rongai, Thika, Kisumu"></label>`);
    if (f === 'pickupPoint' && showPickup && points.length) parts.push(`<label class="sf-field" data-when="pickup" hidden>Pickup point<select name="pickupPoint">${points.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>`);
    if (f === 'deliveryDay') parts.push(`<label class="sf-field">Delivery day<select name="deliveryDay"><option>Today</option><option>Tomorrow</option><option>Let's agree a date</option></select></label>`);
    if (f === 'paymentMethod') parts.push(methods.length === 1
      ? `<div class="sf-field sf-field--fixed"><span>Payment</span><strong>${esc(methods[0])}</strong><input type="hidden" name="paymentMethod" value="${esc(methods[0])}"></div>`
      : `<fieldset class="sf-field sf-field--choice"><legend>Payment</legend>${methods.map((m, i) => `<label class="sf-choice"><input type="radio" name="paymentMethod" value="${esc(m)}"${i ? '' : ' checked'}><span>${esc(m)}</span></label>`).join('')}</fieldset>`);
    if (f === 'notes') parts.push(`<label class="sf-field">Notes <small>(optional)</small><textarea name="notes" rows="2" placeholder="Anything we should know?"></textarea></label>`);
    if (f === 'giftMessage') parts.push(`<label class="sf-field">Gift message <small>(optional)</small><textarea name="giftMessage" rows="2"></textarea></label>`);
  }
  return parts.join('');
}

export function cartDrawer({ store }) {
  return `<div class="sf-drawer" data-cart hidden>
<div class="sf-drawer__scrim" data-cart-close></div>
<aside class="sf-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="sf-cart-title">
<div class="sf-drawer__head"><h2 id="sf-cart-title">Your cart</h2><button type="button" class="sf-close" data-cart-close aria-label="Close cart">×</button></div>
<div class="sf-drawer__view" data-view="cart">
<ul class="sf-lines" data-lines></ul>
<div class="sf-cart-empty" data-cart-empty><p>Your cart is empty.</p><a class="sf-cta sf-cta--ghost" href="${esc(store.browseHref || '/shop')}">Browse ${esc(store.nouns?.many || 'products')}</a></div>
<div class="sf-drawer__foot" data-cart-foot hidden><p class="sf-total"><span>Total</span><strong data-cart-total>KSh 0</strong></p><button type="button" class="sf-cta sf-cta--block" data-checkout-open>Checkout on WhatsApp</button><p class="sf-fine">You'll confirm availability and condition with a real person on WhatsApp before you pay.</p></div>
</div>
<form class="sf-drawer__view sf-checkout" data-view="checkout" data-checkout novalidate hidden>
<button type="button" class="sf-textlink" data-view-go="cart">← Back to cart</button>
<h3>Your details</h3>
${checkoutForm({ store })}
<button type="submit" class="sf-cta sf-cta--block">Preview WhatsApp message</button>
</form>
<div class="sf-drawer__view" data-view="preview" hidden>
<button type="button" class="sf-textlink" data-view-go="checkout">← Edit details</button>
<h3>Your message</h3>
<p class="sf-fine">This opens in WhatsApp, ready to send to ${esc(store.name)} (${esc(store.phoneDisplay)}).</p>
<div class="sf-bubble" data-preview></div>
<a class="sf-cta sf-cta--block sf-cta--wa" data-wa-send href="${waHref(store.whatsapp)}" target="_blank" rel="noopener">Open WhatsApp ↗</a>
</div>
</aside></div>
<template id="sf-line"><li class="sf-line"><div class="sf-line__body"><p class="sf-line__name" data-slot="name"></p><div class="sf-line__row"><div class="sf-qty"><button type="button" data-act="dec" aria-label="One fewer">−</button><output data-slot="qty">1</output><button type="button" data-act="inc" aria-label="One more">+</button></div><strong data-slot="total"></strong></div><button type="button" class="sf-textlink" data-act="remove">Remove</button></div></li></template>
<div class="sf-toast" data-toast role="status" hidden></div>`;
}

// ---- homepage sections ----
const tones = (n, start = 0) => Array.from({ length: n }, (_, i) => ((i + start) % 2 === 0 ? 'ink' : 'paper'));

function banner(b, { tone, fallback, level = 2, big = false }) {
  const cls = `sf-banner sf-banner--${b.image?.src ? 'photo' : fallback === 'gradient' ? 'gradient' : tone} sf-banner--copy-${b.copySide || 'left'}${big ? ' sf-banner--big' : ''}`;
  return `<a class="${cls}" href="${esc(b.href)}">${b.image?.src ? imageRef(b.image, { cls: 'sf-banner__img', alt: '' }) : ''}<span class="sf-banner__copy"><span class="sf-banner__headline" role="heading" aria-level="${level}">${esc(b.headline)}</span>${b.sub ? `<span class="sf-banner__sub">${esc(b.sub)}</span>` : ''}<span class="sf-banner__cta">${esc(b.cta)} →</span></span></a>`;
}

function hero(s, ctx) {
  const fallback = ctx.store.bannerFallback;
  if (s.variant === 'split') {
    const { main, tiles } = s.data;
    return `<section class="sf-hero sf-hero--split" data-section="hero"><div class="sf-wrap sf-hero__grid">
<a class="sf-banner sf-banner--${fallback === 'gradient' ? 'gradient' : 'ink'} sf-banner--big sf-hero__main" href="${esc(main.href)}"><span class="sf-banner__copy"><h1 class="sf-hero__title">${esc(main.headline)}</h1>${main.sub ? `<span class="sf-banner__sub">${esc(main.sub)}</span>` : ''}<span class="sf-cta sf-cta--accent">${esc(main.cta)} →</span></span></a>
<div class="sf-hero__tiles">${tiles.map((b, i) => banner(b, { tone: i === 0 ? 'accent' : 'paper', fallback })).join('')}</div>
</div></section>`;
  }
  if (s.variant === 'spotlight') {
    const p = s.data.product, m = ctx.models.get(p.modelId), { title, config } = nameParts(p, m);
    return `<section class="sf-hero sf-hero--spotlight" data-section="hero"><div class="sf-wrap sf-showcase__grid"><a class="sf-showcase__media" href="${esc(p.href || routes.product(p.slug))}" tabindex="-1" aria-hidden="true">${imageRef(p.images?.[0], { eager: true, alt: title })}</a><div class="sf-showcase__copy"><h1>${esc(title)}</h1><p class="sf-mono">${esc(configLine(config))}</p>${priceTag(p.price, { size: 'sf-price--lg' })}<a class="sf-cta" href="${esc(p.href || routes.product(p.slug))}">See this ${esc(ctx.store.nouns?.one || 'product')} →</a></div></div></section>`;
  }
  const b = s.data.banners[0];
  return `<section class="sf-hero sf-hero--banner" data-section="hero"><div class="sf-wrap"><a class="sf-banner sf-banner--${fallback === 'gradient' ? 'gradient' : 'ink'} sf-banner--big" href="${esc(b.href)}"><span class="sf-banner__copy"><h1 class="sf-hero__title">${esc(b.headline)}</h1>${b.sub ? `<span class="sf-banner__sub">${esc(b.sub)}</span>` : ''}<span class="sf-cta sf-cta--accent">${esc(b.cta)} →</span></span></a></div></section>`;
}

function categoryNav(s) {
  return wrapSection('categoryNav', s.variant, `${head(s.title || 'Shop by category')}<nav class="sf-catnav" aria-label="${esc(s.title || 'Categories')}">${s.data.categories.map((c) => `<a class="sf-catnav__item" href="${esc(c.href)}"><span class="sf-catnav__circle${c.image?.src ? ' sf-catnav__circle--photo' : ''}" style="--tint:${esc(c.image?.placeholder?.tint || '#E8E6E1')}" aria-hidden="true">${c.image?.src ? imageRef(c.image, { alt: '' }) : esc(c.image?.placeholder?.glyph || c.name[0])}</span><span class="sf-catnav__name">${esc(c.name)}</span><span class="sf-catnav__count">${c.count}</span></a>`).join('')}</nav>`);
}

const cards = (products, ctx) => products.map((p) => productCard(p, { model: ctx.models.get(p.modelId) })).join('');

function productRail(s, ctx, idx) {
  const noun = ctx.store.nouns?.many || 'products';
  if (s.variant === 'tabs') {
    const id = `rail${idx}`;
    return wrapSection('productRail', 'tabs', `${head(s.title)}
<div class="sf-tabs" role="tablist" aria-label="${esc(s.title)}">${s.data.tabs.map((t, i) => `<button type="button" role="tab" id="${id}-t${i}" aria-controls="${id}-p${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(t.label)} <small>${t.all.length}</small></button>`).join('')}</div>
${s.data.tabs.map((t, i) => `<div class="sf-tabpanel" role="tabpanel" id="${id}-p${i}" aria-labelledby="${id}-t${i}"${i ? ' hidden' : ''}><div class="sf-scroller">${cards(t.products, ctx)}</div><p class="sf-tabpanel__more">${seeAll(t.href, t.all.length, `${t.label.toLowerCase()} ${noun}`)}</p></div>`).join('')}`, ' data-tabs');
  }
  const more = s.seeAll || s.variant !== 'carousel' ? seeAll(s.data.href, s.data.all.length, `${(s.title || '').toLowerCase()}`) : '';
  const body = s.variant === 'carousel'
    ? `<div class="sf-carousel" data-carousel><div class="sf-scroller" data-scroller>${cards(s.data.products, ctx)}</div><button type="button" class="sf-carousel__btn sf-carousel__btn--prev" data-scroll="-1" aria-label="Scroll back">‹</button><button type="button" class="sf-carousel__btn sf-carousel__btn--next" data-scroll="1" aria-label="Scroll forward">›</button></div>`
    : `<div class="sf-grid sf-grid--rail">${cards(s.data.products, ctx)}</div>`;
  return wrapSection('productRail', s.variant, head(s.title || 'Featured', more) + body);
}

function promoBanner(s, ctx) {
  const t = tones(s.data.banners.length);
  return wrapSection('promoBanner', s.variant, `<div class="sf-promos sf-promos--${s.data.banners.length}">${s.data.banners.map((b, i) => banner(b, { tone: t[i], fallback: ctx.store.bannerFallback })).join('')}</div>`);
}

function productShowcase(s, ctx) {
  const p = s.data.product, m = ctx.models.get(p.modelId), { title, config } = nameParts(p, m);
  return wrapSection('productShowcase', s.variant, `<div class="sf-showcase__grid${s.variant === 'right' ? ' sf-showcase__grid--right' : ''}">
<a class="sf-showcase__media" href="${esc(p.href || routes.product(p.slug))}" tabindex="-1" aria-hidden="true">${imageRef(p.images?.[0], { alt: title })}</a>
<div class="sf-showcase__copy"><p class="sf-eyebrow">${esc(s.title || 'Top of the range')}</p><h2>${esc(title)}</h2><p class="sf-mono">${esc(configLine(config))}</p><p>${esc(m?.blurb || '')}</p>${priceTag(p.price, { size: 'sf-price--lg' })}<p><a class="sf-cta" href="${esc(p.href || routes.product(p.slug))}">See the ${esc(title)} →</a></p></div></div>`);
}

function guideTeaser(s) {
  return wrapSection('guideTeaser', s.variant, `${head(s.title || 'Guides', '<a class="sf-textlink" href="/guides">All guides →</a>')}<div class="sf-teasers">${s.data.guides.map((g) => `<article class="sf-teaser"><p class="sf-eyebrow">${esc(g.typeLabel || 'Buying guide')}</p><h3><a href="${routes.guide(g.slug)}">${esc(g.title)}</a></h3><p>${esc(g.description || '')}</p><a class="sf-cta sf-cta--ghost" href="${routes.guide(g.slug)}" aria-label="Read the guide: ${esc(g.title)}">Read the guide →</a></article>`).join('')}</div>`);
}

const trustStrip = (s) => wrapSection('trustStrip', s.variant, `<ul class="sf-trust">${s.data.items.map((t) => `<li><span aria-hidden="true">✓</span> ${esc(t)}</li>`).join('')}</ul>`);

function offerCountdown(s, ctx) {
  const days = Math.max(1, Math.ceil((new Date(s.data.endsAt) - Date.now()) / 864e5));
  return wrapSection('offerCountdown', s.variant, `${head(`Offer ends in ${days} day${days === 1 ? '' : 's'}`)}<div class="sf-grid sf-grid--rail">${cards(s.data.products.slice(0, 4), ctx)}</div>`);
}

const RENDER = { hero, categoryNav, productRail, promoBanner, productShowcase, guideTeaser, trustStrip, offerCountdown };

/** Render composed sections. Announcement and footer are page chrome, so they're returned separately. */
export function renderHomeSections(sections, ctx) {
  let top = '', main = '';
  sections.forEach((s, i) => {
    if (s.type === 'announcement') top = announcement(s.data.text);
    else if (s.type === 'footer') { /* the shell renders the footer */ }
    else if (RENDER[s.type]) main += RENDER[s.type](s, ctx, i);
  });
  return { top, main };
}

export { fill, formatKsh };
