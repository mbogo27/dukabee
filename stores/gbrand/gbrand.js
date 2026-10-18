// GBRAND storefront runtime: bag, size picker, print option, shop filters, quick-add sheet. Vanilla, no dependencies.
// Catalog data comes from catalog.js (window.GB), which the build writes from data/gbrand/*.json.
import { lineKey, ksh, totals, cleanPrintName, cleanPrintNumber, makeRef, orderMessage, withRef } from './cart-logic.js';

const GB = window.GB;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BASE = GB.base || '';
const PREVIEW = !!GB.preview; // preview build: orders are test orders, plus the claim bar
const TEST_LINE = '\u{1F9EA} TEST ORDER from your Duka Bee preview, not a real customer.';
const newRef = () => (PREVIEW ? 'T-' : '') + makeRef();
const asTest = (m) => (PREVIEW ? `${TEST_LINE}\n${m}` : m);
const waLink = (t) => `https://wa.me/${GB.store.wa}?text=${encodeURIComponent(t)}`;
const P = GB.products; // slug -> product
const pFee = GB.offers.print?.enabled === false ? 0 : GB.offers.print?.fee ?? 0;
const unitOf = (p, print) => p.price + (print ? pFee : 0);

/* ---------- analytics: one helper so the provider can be swapped ---------- */
function track(name, params = {}) {
  if (PREVIEW) params = { preview: GB.preview.id, ...params };
  try { (window.dataLayer = window.dataLayer || []).push({ event: name, ...params }); } catch {}
  if (/^(localhost|127\.)/.test(location.hostname)) console.debug('[track]', name, params);
}

/* ---------- storage (always try/catch) ---------- */
const store = {
  get(k, area = 'local') { try { return JSON.parse((area === 'local' ? localStorage : sessionStorage).getItem(k)); } catch { return null; } },
  set(k, v, area = 'local') { try { (area === 'local' ? localStorage : sessionStorage).setItem(k, JSON.stringify(v)); } catch {} },
};

// Affiliate attribution: carry ?ref= from the landing URL.
try {
  const r = new URLSearchParams(location.search).get('ref');
  if (r) store.set('gb:refCode', r.slice(0, 40), 'session');
} catch {}

/* ---------- toast ---------- */
let toastTimer;
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2400);
}

/* ---------- overlays: drawers and the size sheet trap focus, close on Esc and scrim ---------- */
const scrim = $('#scrim');
let openEl = null, lastFocus = null;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
function openOverlay(el) {
  if (openEl && openEl !== el) closeAll(false);
  lastFocus = document.activeElement;
  el.classList.add('on'); el.removeAttribute('inert'); scrim.classList.add('on'); openEl = el;
  document.documentElement.style.overflow = 'hidden'; document.documentElement.classList.add('ov');
  setTimeout(() => ($('[data-close]', el) || el).focus(), 50);
}
function closeAll(restore = true) {
  $$('.drawer,.sheet').forEach((d) => { d.classList.remove('on'); d.setAttribute('inert', ''); });
  scrim.classList.remove('on'); document.documentElement.style.overflow = ''; document.documentElement.classList.remove('ov');
  const had = openEl; openEl = null;
  if (had && restore && lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
$$('.drawer,.sheet').forEach((d) => d.setAttribute('inert', ''));
scrim.addEventListener('click', () => closeAll());
document.addEventListener('keydown', (e) => {
  if (!openEl) return;
  if (e.key === 'Escape') return closeAll();
  if (e.key !== 'Tab') return;
  const f = $$(FOCUSABLE, openEl).filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeAll(); });
$('#openMenu')?.addEventListener('click', () => openOverlay($('#menu')));
// Menu links that stay on the same page should close the menu.
$('#menu')?.addEventListener('click', (e) => { if (e.target.closest('a')) closeAll(false); });

/* ---------- bag ---------- */
let cart = (store.get('gb:cart') || []).filter((l) => P[l.slug]);
let step = 'bag';
const fulfilmentField = GB.checkout.fields.find((f) => f.id === 'fulfilment');
let order = { name: '', phone: '', fulfilment: fulfilmentField?.default || '', location: '', ...(store.get('gb:order') || {}) };
let ref = null;
const T = () => totals(cart, P, GB.offers);
function saveCart() { store.set('gb:cart', cart); store.set('gb:order', order); }

function addToBag(slug, size, print, qty) {
  const k = lineKey(slug, size, print), l = cart.find((x) => x.k === k);
  if (l) l.qty = Math.min(20, l.qty + qty); else cart.push({ k, slug, size, print, qty });
  saveCart(); syncCart();
  track('add_to_cart', { slug, size, print: !!print, qty, value: unitOf(P[slug], print) * qty, currency: 'KES' });
  toast(`${P[slug].name} (${size}) added`);
}

function syncCart() {
  const c = T().count;
  $$('[data-cart-count]').forEach((n) => { n.textContent = c; });
  renderCart();
}

const fField = (id) => GB.checkout.fields.find((f) => f.id === id) || {};
const needsLocation = () => (fField('location').requiredFor || []).includes(order.fulfilment);
const customer = () => ({ ...order, location: needsLocation() ? order.location : '' });
const PHONE_RE = /^(\+?254|0)[17]\d{8}$/;
/** Name and phone are required; town or estate only for the delivery options that need an address. */
function checkoutErrors() {
  const e = {};
  if (fField('name').required && !order.name.trim()) e.name = 'Enter your name.';
  if (fField('phone').required && !PHONE_RE.test(order.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a valid phone number, e.g. 0712 345 678.';
  if (needsLocation() && !order.location.trim()) e.location = 'Add your town or estate.';
  return e;
}
let tried = false;
function syncErrors() {
  const e = checkoutErrors();
  [['name', 'oName'], ['phone', 'oPhone'], ['location', 'oLoc']].forEach(([k, id]) => {
    const input = $('#' + id), err = $('#e-' + k); if (!input) return;
    err.textContent = tried && e[k] ? e[k] : ''; input.setAttribute('aria-invalid', tried && e[k] ? 'true' : 'false');
  });
  const btn = $('#sendWa'); if (btn) btn.setAttribute('aria-disabled', Object.keys(e).length ? 'true' : 'false');
  return e;
}
const message = () => asTest(orderMessage({ template: GB.checkout.messageTemplate, lines: cart, products: P, offers: GB.offers, customer: customer(), ref }));

function renderCart() {
  const body = $('#cartBody'), foot = $('#cartFoot');
  if (!cart.length) {
    step = 'bag'; $('#cartTitle').textContent = 'Your bag';
    body.innerHTML = '<p class="empty">Your bag is empty.<br>Pick a kit to get started.</p>';
    foot.innerHTML = `<a href="${BASE}/shop" class="btn">Shop kits</a>`; return;
  }
  const t = T(), pair = GB.offers.pairBundle;
  if (step === 'bag') {
    $('#cartTitle').textContent = `Your bag (${t.count})`;
    body.innerHTML = cart.map((l) => {
      const p = P[l.slug];
      return `<div class="line"><div class="th"><img src="${p.thumb}" alt="" width="400" height="500"></div><div><b>${esc(p.name)}</b><small>Size ${l.size}${l.print ? ` · ${esc(l.print.name)} ${esc(l.print.number)} (+${ksh(pFee)})` : ''}</small><span class="price" style="font-size:15px">${ksh(unitOf(p, l.print))}</span><div class="qty"><button data-cq="${esc(l.k)}" data-d="-1" aria-label="One less ${esc(p.name)}">−</button><span>${l.qty}</span><button data-cq="${esc(l.k)}" data-d="1" aria-label="One more ${esc(p.name)}">+</button></div></div><button class="rm" data-crm="${esc(l.k)}" aria-label="Remove ${esc(p.name)}">Remove</button></div>`;
    }).join('');
    const nudge = pair?.enabled !== false && t.jerseyUnits === 1 ? `<p class="note">Add one more kit and pay <b>${ksh(pair.pairPrice)}</b> for the pair.</p>` : '';
    foot.innerHTML = `${nudge}<div class="tot"><span>Subtotal</span><span>${ksh(t.subtotal)}</span></div>${t.discount ? `<div class="tot disc"><span>Pair deal</span><span>−${ksh(t.discount)}</span></div>` : ''}<div class="tot big"><span>Total</span><span>${ksh(t.total)}</span></div><p class="note">Delivery fee confirmed on WhatsApp.</p><button class="btn btn--red" id="toOrder">Continue to order</button>`;
    return;
  }
  // details step
  $('#cartTitle').textContent = 'Your details';
  const f = Object.fromEntries(GB.checkout.fields.map((x) => [x.id, x]));
  body.innerHTML = `<div class="field"><label for="oName">${f.name.label}${f.name.required ? ' *' : ''}</label><input id="oName" value="${esc(order.name)}" autocomplete="name" required aria-describedby="e-name"><p class="err" id="e-name" role="alert"></p></div>
    <div class="field"><label for="oPhone">${f.phone.label}${f.phone.required ? ' *' : ''}</label><input id="oPhone" type="tel" inputmode="tel" value="${esc(order.phone)}" placeholder="${esc(f.phone.placeholder || '')}" autocomplete="tel" required aria-describedby="e-phone"><p class="err" id="e-phone" role="alert"></p></div>
    <div class="field" role="group" aria-labelledby="oDelLbl"><label id="oDelLbl">${f.fulfilment.label}</label><div class="opts">${f.fulfilment.options.map((m) => `<button type="button" class="chip" data-om="${esc(m)}" aria-pressed="${order.fulfilment === m}">${esc(m)}</button>`).join('')}</div></div>
    ${needsLocation() ? `<div class="field"><label for="oLoc">${f.location.label} *</label><input id="oLoc" value="${esc(order.location)}" placeholder="${esc(f.location.placeholder || '')}" required aria-describedby="e-location"><p class="err" id="e-location" role="alert"></p></div>` : ''}
    <div class="field"><label id="msgLbl">Message preview</label><div class="msg" id="msg" role="note" aria-labelledby="msgLbl"></div></div>`;
  foot.innerHTML = `<div class="tot big"><span>Total</span><span>${ksh(t.total)}</span></div>${PREVIEW ? `<p class="note">Preview: this sends a test order to ${esc(GB.preview.storeName)}'s WhatsApp so you can see how orders arrive.</p>` : ''}<a class="btn btn--green" id="sendWa" target="_blank" rel="noopener">${PREVIEW ? 'Send test order on WhatsApp' : 'Send order on WhatsApp'}</a><button class="rm" id="back" style="justify-self:center">Back to bag</button>`;
  ref = ref || newRef();
  const upd = () => { const m = message(); $('#msg').textContent = m; $('#sendWa').href = waLink(m); };
  [['oName', 'name'], ['oPhone', 'phone'], ['oLoc', 'location']].forEach(([id, k]) => $('#' + id)?.addEventListener('input', (e) => { order[k] = e.target.value; saveCart(); syncErrors(); upd(); }));
  upd(); syncErrors();
}

/** Record the order before WhatsApp opens, so the lead exists even if they never hit send. */
let awaitingReturn = false;
function recordOrder(lines, customer, tot, source) {
  const o = {
    ref, createdAt: new Date().toISOString(),
    lines: lines.map((l) => ({ slug: l.slug, sku: P[l.slug].sku, size: l.size, print: l.print || null, qty: l.qty, unitPrice: unitOf(P[l.slug], l.print) })),
    subtotal: tot.subtotal, discount: tot.discount, total: tot.total,
    customer: { name: customer.name || '', phone: customer.phone || '', fulfilment: customer.fulfilment || '', location: customer.location || '' },
    source: 'web',
  };
  const refCode = store.get('gb:refCode', 'session'); if (refCode) o.refCode = refCode;
  console.info('[order]', o);
  if (PREVIEW) { track('preview_test_order', { ref, total: tot.total }); awaitingReturn = true; return; } // test orders are never posted anywhere
  try {
    const body = JSON.stringify(o);
    const queued = navigator.sendBeacon && navigator.sendBeacon('/api/orders', new Blob([body], { type: 'application/json' }));
    if (!queued) fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {}
  track('whatsapp_handoff', { ref, total: tot.total, from: source });
}

document.addEventListener('click', (e) => {
  const q = e.target.closest('[data-cq]');
  if (q) {
    const l = cart.find((x) => x.k === q.dataset.cq); l.qty = Math.min(20, l.qty + +q.dataset.d);
    if (l.qty < 1) { cart = cart.filter((x) => x !== l); track('remove_from_cart', { slug: l.slug }); }
    saveCart(); syncCart(); return;
  }
  const r = e.target.closest('[data-crm]');
  if (r) { const l = cart.find((x) => x.k === r.dataset.crm); cart = cart.filter((x) => x.k !== r.dataset.crm); track('remove_from_cart', { slug: l?.slug }); saveCart(); syncCart(); return; }
  if (e.target.closest('#toOrder')) { step = 'order'; track('begin_checkout', { value: T().total, currency: 'KES' }); renderCart(); return; }
  if (e.target.closest('#back')) { step = 'bag'; renderCart(); return; }
  const m = e.target.closest('[data-om]'); if (m) { order.fulfilment = m.dataset.om; saveCart(); renderCart(); return; }
  if (e.target.closest('#sendWa')) {
    const errs = syncErrors();
    if (Object.keys(errs).length) { e.preventDefault(); tried = true; syncErrors(); const first = ['oName', 'oPhone', 'oLoc'].find((id, i) => errs[['name', 'phone', 'location'][i]]); $('#' + first)?.focus(); return; }
    recordOrder(cart, customer(), T(), 'bag'); ref = null; setTimeout(() => { ref = newRef(); }, 0); return; }
  if (e.target.closest('[data-open-cart]')) { step = 'bag'; renderCart(); openOverlay($('#cart')); track('view_cart', { value: T().total, count: T().count }); }
});

/* ---------- quick-add sheet ---------- */
let sheet = { slug: null, size: null };
function openSheet(slug) {
  const p = P[slug]; sheet = { slug, size: null };
  $('#sheet').innerHTML = `<div class="sheet__top"><div class="th"><img src="${p.thumb}" alt="" width="400" height="500"></div><div><b>${esc(p.name)}</b><div class="price">${ksh(p.price)}</div></div><button class="ico" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
   <div><div class="lbl"><span id="shLbl">Pick your size</span><a href="${BASE}/product/${p.slug}" style="border-bottom:1.5px solid;color:var(--muted)">Add name &amp; number</a></div><div class="sizes" role="group" aria-labelledby="shLbl">${GB.sizes.map((s) => `<button type="button" class="sz" data-ssize="${s}" aria-pressed="false">${s}</button>`).join('')}</div></div>
   <p class="err" id="sheetErr" role="alert"></p><button class="btn btn--red" id="sheetAdd">Add to bag</button>`;
  $('#sheet').setAttribute('aria-label', `Choose a size for ${p.name}`);
  openOverlay($('#sheet')); track('quick_add_open', { slug });
}
document.addEventListener('click', (e) => {
  const q = e.target.closest('[data-quick]'); if (q) return openSheet(q.dataset.quick);
  const s = e.target.closest('[data-ssize]');
  if (s) { sheet.size = s.dataset.ssize; $$('[data-ssize]').forEach((b) => b.setAttribute('aria-pressed', b === s)); $('#sheetErr').textContent = ''; track('select_size', { slug: sheet.slug, size: sheet.size }); return; }
  if (e.target.closest('#sheetAdd')) { if (!sheet.size) { $('#sheetErr').textContent = 'Pick a size first.'; return; } addToBag(sheet.slug, sheet.size, null, 1); closeAll(); }
});

/* ---------- homepage spotlight ---------- */
const spot = $('#spot');
if (spot) {
  const slug = spot.dataset.slug; let size = null;
  spot.addEventListener('click', (e) => {
    const s = e.target.closest('[data-spot-size]');
    if (s) { size = s.dataset.spotSize; $$('[data-spot-size]', spot).forEach((b) => b.setAttribute('aria-pressed', b === s)); $('#spotErr').textContent = ''; track('select_size', { slug, size }); }
    if (e.target.closest('#spotAdd')) { if (!size) { $('#spotErr').textContent = 'Pick a size first.'; return; } addToBag(slug, size, null, 1); }
  });
}

/* ---------- product page ---------- */
const pdRoot = $('#pd');
if (pdRoot) {
  const slug = pdRoot.dataset.slug, p = P[slug];
  const pd = { size: null, print: false, name: '', number: '', qty: 1 };
  const printOf = () => (pd.print ? { name: pd.name.toUpperCase(), number: pd.number } : null);
  const err = (t) => { $('#pdErr').textContent = t; };
  const check = () => {
    if (!pd.size) return 'Pick a size first.';
    if (pd.print && (!pd.name.trim() || pd.number === '')) return 'Add the name and number for the print, or switch printing off.';
    return '';
  };
  const sync = () => {
    $('#pdQ').textContent = pd.qty; $('#pdTotal').textContent = ksh(unitOf(p, pd.print) * pd.qty);
    $('#printFields').hidden = !pd.print;
    $('#bName').textContent = (pd.name || 'YOUR NAME').toUpperCase(); $('#bNum').textContent = pd.number || '00';
    const pr = printOf();
    const line = `• ${p.name} (No.${p.no}) — Size ${pd.size || '?'}${pr ? ` — Print: ${pr.name || '—'} ${pr.number || '—'}` : ''} ×${pd.qty} — ${ksh(unitOf(p, pd.print) * pd.qty)}`;
    ref = ref || newRef();
    $('#pdWa').href = waLink(asTest(withRef(`Hi GBRAND, I'd like to order:\n${line}\n\nPlease confirm stock and delivery.`, ref)));
  };
  pdRoot.addEventListener('click', (e) => {
    const s = e.target.closest('[data-psize]');
    if (s) { pd.size = s.dataset.psize; $$('[data-psize]', pdRoot).forEach((b) => b.setAttribute('aria-pressed', b === s)); err(''); sync(); track('select_size', { slug, size: pd.size }); return; }
    const q = e.target.closest('[data-pq]'); if (q) { pd.qty = Math.max(1, Math.min(10, pd.qty + +q.dataset.pq)); sync(); return; }
    if (e.target.closest('#toGuide')) { const d = $('#guideAcc'); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (e.target.closest('#pdAdd')) { const m = check(); if (m) return err(m); err(''); addToBag(slug, pd.size, printOf(), pd.qty); return; }
    if (e.target.closest('#pdWa')) {
      const m = check(); if (m) { e.preventDefault(); return err(m); }
      err('');
      const line = { slug, size: pd.size, print: printOf(), qty: pd.qty };
      recordOrder([line], {}, totals([line], P, GB.offers), 'product-page');
      ref = null; setTimeout(sync, 0); // next order gets a fresh reference
    }
  });
  pdRoot.addEventListener('input', (e) => {
    if (e.target.id === 'printOn') { pd.print = e.target.checked; sync(); track('toggle_print', { slug, on: pd.print }); }
    if (e.target.id === 'pName') { pd.name = cleanPrintName(e.target.value); e.target.value = pd.name; sync(); }
    if (e.target.id === 'pNum') { pd.number = cleanPrintNumber(e.target.value); e.target.value = pd.number; sync(); }
  });
  sync(); track('view_item', { slug, value: p.price, currency: 'KES' });
}

/* ---------- shop: filters live in the URL ---------- */
const shopRoot = $('#shopGrid');
if (shopRoot) {
  const clubs = GB.clubs, cards = $$('.card', shopRoot), soon = $('.soon', shopRoot), empty = $('#shopEmpty');
  const qs = new URLSearchParams(location.search);
  const state = {
    club: clubs[qs.get('club')] ? qs.get('club') : 'all',
    type: GB.kitTypes.includes(qs.get('type')) ? qs.get('type') : 'all',
    q: (qs.get('q') || '').slice(0, 60),
    sort: ['club', 'new'].includes(qs.get('sort')) ? qs.get('sort') : 'featured',
  };
  const input = $('#q'); input.value = state.q;
  let first = true;
  const apply = () => {
    const needle = state.q.trim().toLowerCase();
    const list = cards.filter((c) => (state.club === 'all' || c.dataset.club === state.club) && (state.type === 'all' || c.dataset.type === state.type) && (!needle || c.dataset.search.includes(needle)));
    list.sort((a, b) => {
      if (state.sort === 'club') return a.dataset.clubName.localeCompare(b.dataset.clubName) || a.dataset.i - b.dataset.i;
      if (state.sort === 'new') return b.dataset.new - a.dataset.new;
      return a.dataset.i - b.dataset.i;
    });
    cards.forEach((c) => { c.hidden = !list.includes(c); });
    list.forEach((c) => soon.before(c)); // reorder in the DOM
    empty.hidden = list.length > 0;
    $('#count').textContent = `${list.length} kit${list.length === 1 ? '' : 's'}`;
    $('#sort').value = state.sort;
    $$('[data-fclub]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.fclub === state.club));
    $$('[data-ftype]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.ftype === state.type));
    $('#shopTitle').innerHTML = state.club !== 'all' ? `<img class="tcr" src="${clubs[state.club].crest}" alt=""><span>${esc(clubs[state.club].name)}</span>` : state.type !== 'all' ? `${esc(state.type)} kits` : 'All kits';
    const out = new URLSearchParams();
    if (state.club !== 'all') out.set('club', state.club);
    if (state.type !== 'all') out.set('type', state.type);
    if (state.q.trim()) out.set('q', state.q.trim());
    if (state.sort !== 'featured') out.set('sort', state.sort);
    const qstr = out.toString();
    try { history.replaceState(null, '', location.pathname + (qstr ? `?${qstr}` : '') + location.hash); } catch {}
    if (!first) track('filter_shop', { club: state.club, type: state.type, sort: state.sort, results: list.length });
    first = false;
  };
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-fclub]'); if (c) { state.club = c.dataset.fclub; apply(); }
    const t = e.target.closest('[data-ftype]'); if (t) { state.type = t.dataset.ftype; apply(); }
  });
  let qt;
  input.addEventListener('input', (e) => { state.q = e.target.value; apply(); clearTimeout(qt); qt = setTimeout(() => state.q.trim() && track('search', { q: state.q.trim() }), 700); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; apply(); });
  apply();
  if (location.hash === '#q') input.focus();
}
// Header search: on the shop page it focuses the box; elsewhere it is a plain link to /shop#q.
$('#hdrSearch')?.addEventListener('click', (e) => { const q = $('#q'); if (q) { e.preventDefault(); q.focus(); q.scrollIntoView({ block: 'center' }); } });

/* ---------- magazine ---------- */
const magRoot = $('#mag');
if (magRoot) {
  const feats = $$('.feat', magRoot), cardsM = $$('.mcard', magRoot);
  const show = (cat) => {
    const head = feats.find((f) => cat === 'All' || f.dataset.cat === cat);
    feats.forEach((f) => { f.hidden = f !== head; });
    cardsM.forEach((c) => { c.hidden = !((cat === 'All' || c.dataset.cat === cat) && c.dataset.slug !== head?.dataset.slug); });
    $$('[data-mcat]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mcat === cat));
  };
  document.addEventListener('click', (e) => { const c = e.target.closest('[data-mcat]'); if (c) show(c.dataset.mcat); });
  show('All');
}
if ($('#post')) track('read_post', { slug: $('#post').dataset.slug });

/* ---------- misc ---------- */
$('#copyPhone')?.addEventListener('click', () => {
  const sel = () => { const r = document.createRange(); r.selectNodeContents($('#phoneTxt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Number selected, copy it'); };
  try { navigator.clipboard.writeText($('#copyPhone').dataset.number).then(() => toast('Number copied')).catch(sel); } catch { sel(); }
});
// "Join drop alerts" is a plain wa.me link: the customer sends the opt-in message themselves. We only log the click.
$('#joinWa')?.addEventListener('click', () => track('join_click', {}));
// ?hero=center previews the centred hero variant next to the default split one.
try { if (new URLSearchParams(location.search).get('hero') === 'center') $('.hero')?.classList.add('hero--center'); } catch {}
syncCart();

/* ---------- preview mode: "That's how orders reach you" + the claim bar and sheet ---------- */
if (PREVIEW) {
  const pv = GB.preview, cl = pv.claim, DAY = 864e5;
  const daysLeft = () => Math.max(0, Math.ceil((Date.parse(pv.expiresAt) - Date.now()) / DAY));
  const endsText = () => { const d = daysLeft(); return d <= 0 ? 'Preview ends today' : `Preview ends in ${d} day${d === 1 ? '' : 's'}`; };
  const urgent = () => daysLeft() <= 3;
  const claimMsg = `Hi Duka Bee, I'd like to claim my store: ${pv.storeName} (preview ${pv.id}). Please send the M-Pesa details.`;
  const kes = (n) => `KSh ${Number(n).toLocaleString('en-KE')}`;
  const sheetEl = $('#sheet'), bar = $('#claimBar'), tab = $('#claimTab');

  function showSheet(html, label) { sheetEl.innerHTML = html; sheetEl.setAttribute('aria-label', label); openOverlay(sheetEl); }
  function claimSheet(from) {
    track('claim_open', { from });
    showSheet(`<div class="sheet__top" style="grid-template-columns:1fr auto"><div><b style="font-size:30px">Make it yours</b></div><button class="ico" data-close aria-label="Close">${$('#cart [data-close]').innerHTML}</button></div>
      <ul class="ticks">
        <li>Your store live on <b>${esc(cl.liveUrl)}</b> (your own domain later)</li>
        <li>WhatsApp orders</li><li>M-Pesa</li><li>The admin to edit products and posts</li><li>Setup and support</li>
      </ul>
      <div class="claim-price"><b>Activation ${kes(cl.activationKes)}</b>${cl.monthlyKes ? `<span>Then ${kes(cl.monthlyKes)} a month</span>` : ''}</div>
      <div id="claimPaySlot"><!-- later: "Pay with M-Pesa" (STK push for the activation fee) becomes the primary button here --></div>
      <a class="btn btn--green" id="claimWa" href="https://wa.me/${cl.whatsapp}?text=${encodeURIComponent(claimMsg)}" target="_blank" rel="noopener">Claim on WhatsApp</a>
      <a class="btn btn--line" id="claimCall" href="tel:+${cl.whatsapp}">Call us ${esc(cl.phoneDisplay)}</a>
      <p class="note">Your products, photos and posts carry over. Nothing to redo.</p>`, 'Make it yours');
  }
  const thanksSheet = () => showSheet(`<div class="sheet__top" style="grid-template-columns:1fr auto"><div><b style="font-size:30px">That's how orders reach you</b></div><button class="ico" data-close aria-label="Close">${$('#cart [data-close]').innerHTML}</button></div>
      <ul class="ticks"><li>Order arrives on WhatsApp</li><li>Customer pays with M-Pesa</li><li>You confirm and deliver</li></ul>
      <button class="btn btn--green" id="thanksClaim">Claim your store</button><button class="rm" data-close style="justify-self:center">Keep exploring</button>`, "That's how orders reach you");

  document.addEventListener('click', (e) => {
    if (e.target.closest('#thanksClaim')) return claimSheet('test-order');
    if (e.target.closest('[data-claim]')) return claimSheet(e.target.closest('[data-claim]').dataset.claim);
    if (e.target.closest('#claimWa')) track('claim_whatsapp', {});
    if (e.target.closest('#claimCall')) track('claim_call', {});
  });
  // Coming back from WhatsApp after a test order.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && awaitingReturn) { awaitingReturn = false; setTimeout(thanksSheet, 350); }
  });

  // The claim bar: after 4 seconds or the first scroll past the hero. Phones keep it above the store's bottom nav.
  const desktop = () => matchMedia('(min-width:900px)').matches;
  const KEY = 'gb:claimDismissed';
  const dismissed = () => store.get(KEY, 'session') === true;
  let shown = false;
  const render = () => {
    bar.innerHTML = desktop()
      ? `<span class="claimbar__txt"><b>Your ${esc(pv.storeName)} store is ready</b> · <span class="${urgent() ? 'urgent' : ''}">${endsText()}</span></span><button class="btn btn--green" data-claim="bar">Claim your store</button><button class="claimbar__x" id="claimX" aria-label="Dismiss">\u2715</button>`
      : `<span class="claimbar__txt"><b>Your ${esc(pv.storeName)} store is ready</b><small class="${urgent() ? 'urgent' : ''}">${endsText()}</small></span><button class="btn btn--green" data-claim="bar">Claim your store</button>`;
  };
  const place = () => {
    const mbar = $('.mbar');
    document.documentElement.style.setProperty('--mbar-h', desktop() || !mbar ? '0px' : `${mbar.offsetHeight}px`);
  };
  const showBar = () => {
    if (shown) return; shown = true; render(); place();
    bar.classList.add('on'); document.body.classList.add('has-claimbar'); track('claim_bar_view', {});
  };
  const dismiss = () => {
    bar.classList.remove('on'); document.body.classList.remove('has-claimbar'); tab.hidden = false;
    store.set(KEY, true, 'session'); track('claim_bar_dismiss', {});
  };
  document.addEventListener('click', (e) => { if (e.target.closest('#claimX')) dismiss(); });
  tab.addEventListener('click', () => claimSheet('tab'));
  addEventListener('resize', () => { if (shown) { render(); place(); } });
  if (desktop() && dismissed()) { tab.hidden = false; place(); }
  else {
    const hero = $('.hero');
    const past = () => scrollY > (hero ? hero.offsetHeight : 300);
    const onScroll = () => { if (past()) { removeEventListener('scroll', onScroll); showBar(); } };
    addEventListener('scroll', onScroll, { passive: true });
    setTimeout(showBar, 4000);
  }
  place();
}
