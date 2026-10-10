// Kiwanda storefront v2 runtime (ES module). Binds: cart + pre-checkout form → WhatsApp preview, shop facets/search/
// sort with all state in the URL, homepage tabs and carousels, and analytics events. Filtering logic lives in
// catalog.mjs, shared with the build, so the counts here are the counts the build pre-rendered.
import * as C from './catalog.mjs';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cfg = JSON.parse($('#sf-config')?.textContent || '{}');
const noun = cfg.nouns || { one: 'product', many: 'products' };
const plural = (n) => `${n} ${n === 1 ? noun.one : noun.many}`;
const wa = (text) => `https://wa.me/${cfg.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

// ---- analytics: dataLayer + gtag when a store turns one on; console on localhost ----
export function track(event, params = {}) {
  try { (window.dataLayer = window.dataLayer || []).push({ event, ...params }); if (typeof window.gtag === 'function') window.gtag('event', event, params); } catch { /* never break the page for analytics */ }
  if (/^(localhost|127\.)/.test(location.hostname)) console.debug('[track]', event, params);
}

// ---- cart ----
const KEY = `dukabee:${cfg.id}:cart`;
let memory = [];
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return memory; } };
const write = (lines) => { memory = lines; try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* private mode */ } renderCart(); };
const cartEl = $('[data-cart]');
const total = (lines) => lines.reduce((s, l) => s + l.price * l.qty, 0);

function renderCart() {
  const lines = read();
  const count = lines.reduce((n, l) => n + l.qty, 0);
  $$('[data-cart-count]').forEach((b) => { b.textContent = count; b.hidden = count === 0; });
  if (!cartEl) return;
  const tpl = $('#sf-line');
  $('[data-lines]', cartEl).replaceChildren(...lines.map((l) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.slug = l.slug;
    $('[data-slot=name]', node).textContent = l.name;
    $('[data-slot=qty]', node).textContent = l.qty;
    $('[data-slot=total]', node).textContent = C.formatKsh(l.price * l.qty);
    return node;
  }));
  $('[data-cart-empty]', cartEl).hidden = lines.length > 0;
  $('[data-cart-foot]', cartEl).hidden = lines.length === 0;
  $('[data-cart-total]', cartEl).textContent = C.formatKsh(total(lines));
  if (!lines.length) showView('cart');
}
const add = ({ slug, name, price }) => {
  const lines = read();
  const found = lines.find((l) => l.slug === slug);
  if (found) found.qty += 1; else lines.push({ slug, name, price: Number(price), qty: 1 });
  write(lines);
  track('add_to_cart', { slug, price: Number(price) });
};

const showView = (name) => { if (cartEl) $$('[data-view]', cartEl).forEach((v) => { v.hidden = v.dataset.view !== name; }); };
let lastFocus = null;
const openCart = (view = 'cart') => {
  lastFocus = document.activeElement;
  showView(view); cartEl.hidden = false; document.body.classList.add('sf-locked');
  requestAnimationFrame(() => cartEl.classList.add('is-open'));
  $('.sf-close', cartEl).focus();
};
const closeCart = () => {
  cartEl.classList.remove('is-open'); document.body.classList.remove('sf-locked');
  setTimeout(() => { cartEl.hidden = true; }, 180);
  lastFocus?.focus?.();
};

let toastTimer;
function toast(text) {
  const el = $('[data-toast]');
  if (!el) return;
  el.replaceChildren(document.createTextNode(`${text} `));
  const b = document.createElement('button'); b.type = 'button'; b.textContent = 'View cart'; b.dataset.cartOpen = '';
  el.append(b); el.hidden = false; el.classList.add('is-on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.classList.remove('is-on'); setTimeout(() => { el.hidden = true; }, 200); }, 2800);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-add],[data-cart-open],[data-cart-close],[data-checkout-open],[data-view-go],[data-act],[data-embed-action],[data-track],[data-wa-send],[data-scroll]');
  if (!t) return;
  if (t.matches('[data-embed-action]')) track('guide_embed_click', { guide: t.dataset.guide, slug: t.dataset.embedSlug, action: t.dataset.embedAction });
  if (t.matches('[data-track]')) track(t.dataset.track, { page: location.pathname });
  if (t.matches('[data-add]')) { add({ slug: t.dataset.add, name: t.dataset.name, price: t.dataset.price }); toast(`Added ${t.dataset.name.split(' · ')[0]}.`); }
  else if (t.matches('[data-cart-open]')) openCart();
  else if (t.matches('[data-cart-close]')) closeCart();
  else if (t.matches('[data-checkout-open]')) { showView('checkout'); $('[name=name]', cartEl)?.focus(); track('begin_checkout', { value: total(read()) }); }
  else if (t.matches('[data-view-go]')) showView(t.dataset.viewGo);
  else if (t.matches('[data-act]')) {
    const slug = t.closest('[data-slug]').dataset.slug, act = t.dataset.act;
    write(read().map((l) => (l.slug !== slug ? l : act === 'remove' ? null : { ...l, qty: l.qty + (act === 'inc' ? 1 : -1) })).filter((l) => l && l.qty > 0));
  } else if (t.matches('[data-wa-send]')) track('whatsapp_order', { value: total(read()), ref: t.dataset.ref });
  else if (t.matches('[data-scroll]')) { const sc = $('[data-scroller]', t.closest('[data-carousel]')); sc.scrollBy({ left: Number(t.dataset.scroll) * sc.clientWidth * 0.85, behavior: 'smooth' }); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cartEl && !cartEl.hidden) closeCart(); });
window.addEventListener('storage', (e) => { if (e.key === KEY) renderCart(); });

// ---- pre-checkout form (v2 Phase 4) → message preview → wa.me ----
const form = $('[data-checkout]');
if (form) {
  const syncFulfilment = () => {
    const mode = new FormData(form).get('fulfilment');
    $$('[data-when]', form).forEach((f) => {
      f.hidden = f.dataset.when !== mode;
      $$('input,select', f).forEach((i) => { i.required = !f.hidden && i.name === 'deliveryArea'; });
    });
  };
  form.addEventListener('change', syncFulfilment);
  syncFulfilment();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const f = new FormData(form);
    const lines = read();
    const co = cfg.checkout || {};
    const ref = `${co.orderRefPrefix || 'ORD'}-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const fulfil = f.get('fulfilment') === 'pickup'
      ? (f.get('pickupPoint') ? `I'll pick up at ${f.get('pickupPoint')}` : 'Pickup: we\'ll agree a point on WhatsApp')
      : f.get('deliveryArea') ? `Deliver to: ${f.get('deliveryArea')}` : '';
    const msg = [
      `Hi ${cfg.name}, I'd like to order:`,
      ...lines.map((l) => `• ${l.qty} × ${l.name} (${C.formatKsh(l.price * l.qty)})`),
      `Total: ${C.formatKsh(total(lines))}`,
      `Name: ${f.get('name')}`,
      fulfil,
      f.get('deliveryDay') ? `Delivery day: ${f.get('deliveryDay')}` : '',
      f.get('paymentMethod') ? `Payment: ${f.get('paymentMethod')}` : '',
      f.get('notes') ? `Note: ${f.get('notes')}` : '',
      f.get('giftMessage') ? `Gift message: ${f.get('giftMessage')}` : '',
      co.closingLine || '',
      `Ref: ${ref}`,
    ].filter(Boolean).join('\n');
    $('[data-preview]', cartEl).textContent = msg;
    const send = $('[data-wa-send]', cartEl);
    send.href = wa(msg); send.dataset.ref = ref;
    showView('preview'); send.focus();
    track('checkout_preview', { value: total(lines), ref });
  });
}

// ---- homepage: tabs (roving tabindex) ----
$$('[data-tabs]').forEach((sec) => {
  const tabs = $$('[role=tab]', sec);
  const select = (tab) => {
    tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $(`#${t.getAttribute('aria-controls')}`).hidden = !on; });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; select(n); n.focus(); e.preventDefault(); }
    });
  });
});

// ---- shop: facets, category chips, search, sort; state lives in the query string ----
const shop = $('[data-shop]');
if (shop) {
  const data = JSON.parse($('#sf-index').textContent);
  const keys = data.defs.map((d) => d.key);
  const ctx = { termsOf: (p) => p.terms, buckets: data.buckets };
  const grid = $('#sf-results');
  const cards = new Map($$('.sf-card', grid).map((c) => [c.dataset.slug, c]));
  const filters = $('[data-filters]');
  const searchInputs = [$('#sf-shop-q'), $('#sf-q')].filter(Boolean);
  // A category page lists one category; a stale ?category= from an old /shop link must not empty it.
  const readQuery = () => { const parsed = C.parseQuery(location.search, keys); if (data.pageCategory) parsed.category = null; return parsed; };
  const nouns = data.nouns || noun;
  const plural = (n) => `${n} ${n === 1 ? nouns.one : nouns.many}`;
  let q = readQuery();

  const robots = () => {
    let m = $('meta[name=robots]');
    if (location.search) { if (!m) { m = document.createElement('meta'); m.name = 'robots'; document.head.append(m); } m.content = 'noindex, follow'; } else m?.remove();
  };

  const render = () => {
    const res = C.results(data.products, q, ctx);
    const shown = new Set(res.map((p) => p.slug));
    grid.append(...res.map((p) => cards.get(p.slug)).filter(Boolean));
    cards.forEach((card, slug) => { card.hidden = !shown.has(slug); });
    $('[data-result-count]').textContent = plural(res.length);
    $$('[data-filters-apply]').forEach((b) => { b.textContent = `Show ${plural(res.length)}`; });
    const emptyEl = $('[data-empty]');
    emptyEl.hidden = res.length > 0; grid.hidden = res.length === 0;
    if (!res.length) {
      const summary = C.filterSummary(q, { defs: data.defs, buckets: data.buckets, categories: data.categories }) || `any ${noun.one}`;
      const link = $('[data-sourcing]'); link.href = wa((data.emptyMessage || 'Hi, I\'m looking for: {summary}').replace('{summary}', summary)); link.dataset.summary = summary;
    }

    const counts = C.facetCounts(data.products, q, data.facets, ctx);
    const visible = new Set(C.visibleFacetKeys(data.products, q, data.facets));
    for (const f of data.facets) {
      const box = $(`[data-facet="${CSS.escape(f.key)}"]`, filters);
      if (!box) continue;
      const chosen = f.key === 'price' ? q.price : q.attrs[f.key] || [];
      box.hidden = !visible.has(f.key) && !chosen.length;
      $('[data-facet-n]', box).textContent = chosen.length ? ` (${chosen.length})` : '';
      $$('input', box).forEach((input) => {
        const n = counts[f.key]?.[input.value] || 0;
        input.checked = chosen.includes(input.value);
        input.disabled = !input.checked && n === 0;
        input.closest('label').querySelector('[data-count]').textContent = n;
      });
    }
    const catTotal = Object.values(counts.category || {}).reduce((a, b) => a + b, 0);
    $$('[data-category]').forEach((a) => {
      const id = a.dataset.category;
      a.setAttribute('aria-current', String((q.category || '') === id));
      const n = a.querySelector('[data-cat-count]'); if (n) n.textContent = id ? counts.category?.[id] || 0 : catTotal;
    });

    // Active filters as removable chips.
    const active = $('[data-active]');
    const chips = [];
    const label = (key, v) => (key === 'price' ? C.rangeLabel(v, data.buckets) : `${data.defs.find((d) => d.key === key)?.label || key}: ${v}`);
    q.price.forEach((v) => chips.push(['price', v, C.rangeLabel(v, data.buckets)]));
    for (const d of data.defs) (q.attrs[d.key] || []).forEach((v) => chips.push([d.key, v, label(d.key, v)]));
    if (q.q) chips.push(['q', q.q, `“${q.q}”`]);
    const button = (cls, text, data) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = cls; b.textContent = text;
      Object.entries(data).forEach(([k, v]) => { b.dataset[k] = v; });
      return b;
    };
    active.replaceChildren(...chips.map(([k, v, text]) => {
      const b = button('sf-chip sf-chip--remove', `${text} ×`, { remove: k, value: v });
      b.setAttribute('aria-label', `Remove ${text}`);
      return b;
    }));
    if (chips.length) active.append(button('sf-textlink', 'Clear all', { clear: '' }));
    active.hidden = chips.length === 0;
    const n = C.activeFilterCount(q);
    $$('[data-filter-n]').forEach((el) => { el.textContent = n ? `(${n})` : ''; });
    $('[data-sort]').value = q.sort;
    searchInputs.forEach((i) => { if (document.activeElement !== i) i.value = q.q; });
    robots();
  };

  const commit = (mutate, push = true) => {
    mutate(q);
    const s = C.serializeQuery(q, keys);
    const url = `${location.pathname}${s ? `?${s}` : ''}`;
    if (url !== `${location.pathname}${location.search}`) history[push ? 'pushState' : 'replaceState'](null, '', url);
    render();
  };

  filters.addEventListener('change', (e) => {
    const i = e.target;
    if (i.type !== 'checkbox') return;
    commit((s) => {
      const list = i.name === 'price' ? s.price : (s.attrs[i.name] ||= []);
      const at = list.indexOf(i.value);
      if (i.checked && at < 0) list.push(i.value); else if (!i.checked && at >= 0) list.splice(at, 1);
      if (i.name !== 'price' && !list.length) delete s.attrs[i.name];
    });
  });
  document.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-category]');
    if (cat) { e.preventDefault(); commit((s) => { s.category = cat.dataset.category || null; }); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      commit((s) => {
        const k = rm.dataset.remove, v = rm.dataset.value;
        if (k === 'q') s.q = ''; else if (k === 'price') s.price = s.price.filter((x) => x !== v);
        else { s.attrs[k] = (s.attrs[k] || []).filter((x) => x !== v); if (!s.attrs[k].length) delete s.attrs[k]; }
      });
      return;
    }
    if (e.target.closest('[data-clear]')) { commit((s) => { Object.assign(s, { ...C.emptyQuery(), sort: s.sort }); }); return; }
    if (e.target.closest('[data-filters-open]')) { filters.classList.add('is-open'); document.body.classList.add('sf-locked'); $('[data-filters-close]', filters).focus(); return; }
    if (e.target.closest('[data-filters-close]')) { filters.classList.remove('is-open'); document.body.classList.remove('sf-locked'); return; }
    const src = e.target.closest('[data-sourcing]');
    if (src) track('sourcing_request', { filters: C.serializeQuery(q, keys), summary: src.dataset.summary });
  });
  $('[data-sort]').addEventListener('change', (e) => commit((s) => { s.sort = e.target.value; }));
  let typing;
  searchInputs.forEach((input) => {
    input.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => commit((s) => { s.q = input.value.trim(); }, false), 120); });
    input.form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(typing); commit((s) => { s.q = input.value.trim(); }, true); input.blur(); });
  });
  window.addEventListener('popstate', () => { q = readQuery(); render(); });
  render();
}

renderCart();

// ---- model page: the variant (offer) selector shows that offer's price, buttons and specs; ?variant= keeps it ----
// The URL keeps ?variant= so a shared link opens the same configuration; the canonical stays the model page.
const variants = $('[data-variants]');
if (variants) {
  const panels = $$('[data-variant-panel]');
  const show = (slug, push) => {
    if (!panels.some((p) => p.dataset.variantPanel === slug)) return;
    panels.forEach((p) => { p.hidden = p.dataset.variantPanel !== slug; });
    const radio = $(`input[value="${CSS.escape(slug)}"]`, variants); if (radio) radio.checked = true;
    if (push) { const u = new URL(location.href); u.searchParams.set('variant', slug); history.replaceState(null, '', u); }
  };
  variants.addEventListener('change', (e) => { if (e.target.name === 'variant') { show(e.target.value, true); track('variant_select', { slug: e.target.value }); } });
  const wanted = new URLSearchParams(location.search).get('variant');
  if (wanted) show(wanted, false);
}

// ---- find-my-laptop quiz: answers map onto the same tags and offer fields as the rest of the site ----
const quiz = $('[data-quiz]');
if (quiz) {
  const data = JSON.parse($('#sf-quiz').textContent);
  const form = $('[data-quiz-form]', quiz);
  const out = $('[data-quiz-results]', quiz);
  const range = (id) => (id === 'any' ? null : C.parseRange(id));
  const isPower = (m) => m.feature.includes('dedicated-graphics') || m.offers.some((o) => o.ram >= 16 || /i7|Ryzen 7/.test(o.cpu));
  const isPortable = (m) => m.feature.includes('compact') || (m.screen && m.screen <= 13.3);

  function match(a, relax = 0) {
    const r = range(a.budget);
    return data.models.map((m) => {
      let offers = m.offers.filter((o) => o.available);
      if (a.touch === 'yes' && relax < 1) offers = offers.filter((o) => o.touch);
      if (a.touch === 'no' && relax < 1) offers = offers.filter((o) => !o.touch);
      const inBudget = r ? offers.filter((o) => C.inRange(o.price, r)) : offers;
      const pool = relax < 3 ? inBudget : offers;
      if (!pool.length) return null;
      let score = 0;
      const why = [];
      if (m.use.includes(a.use)) { score += 3; why.push(`good for ${data.useLabels[a.use].toLowerCase()}`); }
      else if (relax < 2) return null;
      if (a.style === 'portable' && isPortable(m)) { score += 2; why.push(`light and portable${m.screen ? ` (${m.screen}-inch)` : ''}`); }
      if (a.style === 'power' && isPower(m)) { score += 2; why.push('extra power (16GB RAM, an i7/Ryzen 7 or dedicated graphics)'); }
      if (a.style === 'portable' && !isPortable(m) && relax < 2) score -= 1;
      const best = pool.slice().sort((x, y) => (a.style === 'power' ? y.ram - x.ram || x.price - y.price : x.price - y.price))[0];
      // Prefer machines that stay useful: Windows 11 support (security updates) and at least 8GB of RAM.
      if (m.feature.includes('windows-11-ready') || m.feature.includes('macos')) score += 1;
      if (best.ram >= 8) score += 1;
      if (a.touch === 'yes' && best.touch) why.push('touchscreen');
      if (r && C.inRange(best.price, r)) why.push(`within your budget at ${C.formatKsh(best.price)}`);
      return { m, best, score, why };
    }).filter(Boolean).sort((x, y) => y.score - x.score || x.best.price - y.best.price);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const a = { use: f.get('use'), budget: f.get('budget'), style: f.get('style'), touch: f.get('touch') };
    const missing = Object.entries(a).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) { $(`input[name="${missing[0]}"]`, form).focus(); form.reportValidity(); return; }
    // Always return something: relax touch, then use case, then budget until there are matches.
    let relax = 0, found = match(a, 0);
    while (found.length < 2 && relax < 3) found = match(a, ++relax);
    const picks = found.slice(0, 3);
    const guide = data.guides.find((g) => g.tags.includes(a.use));
    const summary = `${data.useLabels[a.use]}, budget ${a.budget === 'any' ? 'open' : C.rangeLabel(a.budget, [])}, ${a.style === 'either' ? 'no preference on size' : a.style === 'portable' ? 'light and portable' : 'more power'}, touchscreen: ${a.touch === 'either' ? "don't mind" : a.touch}`;
    const msg = (m) => `Hi Dobatron, Find my laptop suggested the ${m.name}. What I need: ${summary}. Is one available? ${location.origin}${m.href}`;
    out.replaceChildren();
    const h = document.createElement('h2');
    h.textContent = relax ? 'The closest matches we can source' : `Your ${picks.length === 1 ? 'match' : `${picks.length} matches`}`;
    out.append(h);
    if (relax) { const p = document.createElement('p'); p.textContent = "Nothing matched every answer exactly, so these are the closest. Tell us what you need on WhatsApp and we'll try to source it."; out.append(p); }
    for (const { m, best, why } of picks) {
      const card = document.createElement('article');
      card.className = 'sf-match';
      const img = m.image ? Object.assign(document.createElement('img'), { src: m.image, alt: m.name, className: 'sf-img', loading: 'lazy' }) : document.createElement('div');
      const body = document.createElement('div');
      const title = document.createElement('h3'); const link = Object.assign(document.createElement('a'), { href: best.href, textContent: m.name }); title.append(link);
      const cfg = Object.assign(document.createElement('p'), { className: 'sf-mono', textContent: `${best.label} · ${C.formatKsh(best.price)}` });
      const reason = Object.assign(document.createElement('p'), { className: 'sf-match__why', textContent: why.length ? `Why: ${why.join(', ')}.` : 'The closest fit we can source right now.' });
      const ctas = Object.assign(document.createElement('div'), { className: 'sf-match__ctas' });
      ctas.append(Object.assign(document.createElement('a'), { className: 'sf-cta', href: best.href, textContent: 'See this laptop' }));
      const w = Object.assign(document.createElement('a'), { className: 'sf-cta sf-cta--ghost', href: wa(msg(m)), target: '_blank', rel: 'noopener', textContent: 'Ask on WhatsApp ↗' });
      w.addEventListener('click', () => track('quiz_whatsapp', { model: m.slug }));
      ctas.append(w);
      body.append(title, cfg, reason, ctas);
      card.append(img, body);
      out.append(card);
    }
    if (guide) { const p = document.createElement('p'); p.append('Want to read before you buy? '); p.append(Object.assign(document.createElement('a'), { href: guide.href, textContent: guide.title })); out.append(p); }
    const again = Object.assign(document.createElement('button'), { type: 'button', className: 'sf-textlink', textContent: 'Change my answers' });
    again.addEventListener('click', () => { out.hidden = true; form.hidden = false; form.scrollIntoView({ behavior: 'smooth' }); });
    out.append(again);
    form.hidden = true; out.hidden = false; out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Log the answers: they show what buyers want and which models and guides to add.
    track('quiz_complete', { ...a, relaxed: relax, results: picks.map((p) => p.m.slug).join(',') });
  });
}

// ---- product photo gallery: thumbnails scroll the swipeable track; the track's position marks the thumbnail ----
$$('[data-gallery]').forEach((g) => {
  const track = $('[data-gallery-track]', g);
  const thumbs = $$('[data-gallery-to]', g);
  thumbs.forEach((t) => t.addEventListener('click', () => track.scrollTo({ left: Number(t.dataset.galleryTo) * track.clientWidth, behavior: 'smooth' })));
  let tick;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(tick);
    tick = requestAnimationFrame(() => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      thumbs.forEach((t, n) => t.setAttribute('aria-current', String(n === i)));
    });
  });
});
