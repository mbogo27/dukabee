import { emptyDraft, seedCatalog, blankProduct, normalisePhone, MAX_PRODUCTS, MIN_PRODUCTS } from '/lib/launch/store.mjs';
import { NICHES, POLICY_PRESETS } from '/lib/launch/niches.mjs';
import { VIBES, isHex } from '/lib/launch/brand.mjs';
import { CONTACT_WA, ACTIVATION_FEE } from '/lib/launch/config.mjs';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- draft (persisted so a refresh never loses work) ----------
const KEY = 'dukabee:draft:local';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
let draft = load();
if (!draft || draft.v !== 1) draft = emptyDraft();
let saveTimer;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(draft)); }
    catch {
      // Quota: keep everything but the photos so the preview still works with placeholders.
      try { localStorage.setItem(KEY, JSON.stringify({ ...draft, catalog: { ...draft.catalog, products: draft.catalog.products.map((p) => ({ ...p, photo: null })) } })); } catch {}
    }
  }, 150);
};
const saveNow = () => { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch { try { localStorage.setItem(KEY, JSON.stringify({ ...draft, catalog: { ...draft.catalog, products: draft.catalog.products.map((p) => ({ ...p, photo: null })) } })); } catch {} } };

const q = new URLSearchParams(location.search);
if (!draft.brand.name && q.get('name')) draft.brand.name = q.get('name').slice(0, 40);
if (!draft.details.phone && q.get('wa')) draft.details.phone = q.get('wa').slice(0, 20);

let step = 0;
let maxStep = 0;

// ---------- images ----------
const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("We couldn't read that image. Try a PNG or JPG.")); };
  img.src = url;
});
async function shrink(file, { maxSide, type, quality, fill }) {
  if (file.size > 10 * 1024 * 1024) throw new Error('That image is over 10 MB. Try a smaller one.');
  const img = await loadImage(file);
  const w0 = img.naturalWidth || 300, h0 = img.naturalHeight || 300;
  const k = Math.min(1, maxSide / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * k)); canvas.height = Math.max(1, Math.round(h0 * k));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL(type, quality), canvas };
}

// The dominant saturated colour in the logo becomes the brand colour.
function sampleColour(canvas) {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const buckets = new Map();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 200) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 510;
    const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    if (l > 0.92 || l < 0.08 || s < 0.28) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) || { c: 0, w: 0, r: 0, g: 0, b: 0 };
    e.c++; e.w += 1 + s; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  let best = null;
  for (const e of buckets.values()) if (!best || e.w > best.w) best = e;
  if (!best) return null;
  return '#' + [best.r, best.g, best.b].map((v) => Math.round(v / best.c).toString(16).padStart(2, '0')).join('');
}

// ---------- step 1: brand ----------
const SWATCHES = ['#0f6b8f', '#2f6b45', '#b03a5b', '#6b4fbb', '#e0671b', '#c4623a', '#16140f', '#e6a800'];
const swatchesEl = $('#swatches');
swatchesEl.innerHTML = SWATCHES.map((c) => `<button type="button" class="swatch-btn" role="radio" aria-checked="false" aria-label="Colour ${c}" data-color="${c}" style="background:${c}"></button>`).join('')
  + `<label class="swatch-custom"><input type="color" id="f-custom" aria-label="Custom colour" value="#0f6b8f"> Custom</label>`;
$('#vibes').innerHTML = [...Object.entries(VIBES).map(([id, v]) => [id, v.label]), ['surprise', 'Surprise me']]
  .map(([id, label]) => `<label><input type="radio" name="vibe" value="${id}"><span>${label}</span></label>`).join('');

function syncBrand() {
  const b = draft.brand;
  $('#f-name').value = b.name;
  $('#f-wordmark').value = b.wordmark || '';
  const hasLogo = b.mode === 'logo' && b.logo;
  $('#drop').hidden = !!hasLogo;
  $('#logo-preview').hidden = !hasLogo;
  if (hasLogo) $('#logo-img').src = b.logo;
  $('#nologo').hidden = !!hasLogo;
  $$('input[name=brandmode]').forEach((r) => { r.checked = r.value === (b.mode === 'kit' ? 'kit' : 'generic'); });
  $('#kit').hidden = !(b.mode === 'kit' || hasLogo);
  $('#wordmark-field').hidden = !!hasLogo;
  $$('.swatch-btn').forEach((s) => s.setAttribute('aria-checked', String(s.dataset.color.toLowerCase() === (b.primary || '').toLowerCase())));
  if (isHex(b.primary)) $('#f-custom').value = b.primary;
  $$('input[name=vibe]').forEach((r) => { r.checked = r.value === b.vibe; });
  $('#primary-label').textContent = hasLogo ? 'Brand colour (taken from your logo, change it if you like)' : 'Brand colour';
}

$('#f-name').addEventListener('input', (e) => { draft.brand.name = e.target.value; e.target.removeAttribute('aria-invalid'); save(); });
$('#f-wordmark').addEventListener('input', (e) => { draft.brand.wordmark = e.target.value; save(); });
$$('input[name=brandmode]').forEach((r) => r.addEventListener('change', () => { draft.brand.mode = r.value; syncBrand(); save(); }));
swatchesEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]');
  if (!b) return;
  draft.brand.primary = b.dataset.color; syncBrand(); save();
});
$('#f-custom').addEventListener('input', (e) => { draft.brand.primary = e.target.value; $$('.swatch-btn').forEach((s) => s.setAttribute('aria-checked', 'false')); save(); });
$('#vibes').addEventListener('change', (e) => { draft.brand.vibe = e.target.value; save(); });

async function addLogo(file) {
  try {
    const { url, canvas } = await shrink(file, { maxSide: 320, type: 'image/png' });
    const colour = sampleColour(canvas);
    draft.brand.logo = url; draft.brand.mode = 'logo';
    if (colour) draft.brand.primary = colour;
    $('#logo-note').textContent = colour ? 'Logo added. We picked your brand colour from it.' : 'Logo added. Pick a brand colour below.';
    showError(''); syncBrand(); saveNow();
  } catch (err) { showError(err.message); }
}
$('#f-logo').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) addLogo(f); e.target.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) addLogo(f); });
$('#logo-remove').addEventListener('click', () => { draft.brand.logo = null; draft.brand.mode = 'generic'; syncBrand(); save(); });

// ---------- step 2: details ----------
$('#policy').innerHTML = POLICY_PRESETS.map((t) => `<label><input type="checkbox" value="${esc(t)}"><span>${esc(t)}</span></label>`).join('');
function syncDetails() {
  const d = draft.details;
  $('#f-desc').value = d.description; $('#desc-count').textContent = d.description.length;
  $('#f-phone').value = d.phone; $('#f-loc').value = d.location; $('#f-policy').value = d.policyNote;
  $$('#policy input').forEach((i) => { i.checked = d.policy.includes(i.value); });
}
$('#f-desc').addEventListener('input', (e) => { draft.details.description = e.target.value; $('#desc-count').textContent = e.target.value.length; save(); });
$('#f-phone').addEventListener('input', (e) => { draft.details.phone = e.target.value; e.target.removeAttribute('aria-invalid'); save(); });
$('#f-loc').addEventListener('input', (e) => { draft.details.location = e.target.value; save(); });
$('#f-policy').addEventListener('input', (e) => { draft.details.policyNote = e.target.value; save(); });
$('#policy').addEventListener('change', () => { draft.details.policy = $$('#policy input:checked').map((i) => i.value); save(); });

// ---------- step 3: catalog ----------
const nichesEl = $('#niches');
nichesEl.innerHTML = Object.entries(NICHES).map(([id, n]) => `<button type="button" class="niche" data-niche="${id}" aria-pressed="false"><span aria-hidden="true">${n.emoji}</span>${esc(n.label)}</button>`).join('')
  + `<button type="button" class="niche" data-niche="_blank" aria-pressed="false"><span aria-hidden="true">✏️</span>Start from scratch</button>`;
let pendingNiche = null;

function applyNiche(id) {
  if (id === '_blank') {
    draft.catalog = { niche: null, attrLabel: 'Size', attrSelectable: false, dirty: false, products: [blankProduct(0), blankProduct(1), blankProduct(2)] };
  } else seedCatalog(draft, id);
  pendingNiche = null; $('#niche-confirm').hidden = true;
  syncCatalog(); save();
}
nichesEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-niche]');
  if (!b) return;
  if (draft.catalog.dirty && draft.catalog.products.length) { pendingNiche = b.dataset.niche; $('#niche-confirm').hidden = false; $('#niche-yes').focus(); return; }
  applyNiche(b.dataset.niche);
});
$('#niche-yes').addEventListener('click', () => applyNiche(pendingNiche));
$('#niche-no').addEventListener('click', () => { pendingNiche = null; $('#niche-confirm').hidden = true; });

const productHTML = (p, i) => `
  <article class="pcard" data-i="${i}">
    <div class="pcard__photo">
      <div class="pcard__thumb">${p.photo ? `<img src="${p.photo}" alt="">` : 'Branded placeholder'}</div>
      <label class="pcard__upload">${p.photo ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" data-photo aria-label="Photo for product ${i + 1}"></label>
      ${p.photo ? '<button type="button" class="linkbtn" data-photo-remove>Remove photo</button>' : ''}
    </div>
    <div class="pcard__fields">
      <p class="pcard__num">Product ${i + 1}</p>
      <label class="field">Name<input data-f="name" maxlength="80" value="${esc(p.name)}" placeholder="e.g. Linen shirt"></label>
      <div class="pcard__row">
        <label class="field">Price (KSh)<input data-f="price" type="number" inputmode="numeric" min="1" value="${esc(p.price)}" placeholder="1500"></label>
        <label class="field">Category<input data-f="category" list="cats" maxlength="30" value="${esc(p.category)}" placeholder="e.g. Shirts"></label>
      </div>
      <label class="field">Short description<input data-f="description" maxlength="140" value="${esc(p.description)}" placeholder="One line about it"></label>
      <label class="field"><span data-attrname>${esc(draft.catalog.attrLabel || 'Option')}</span> <small>(separate options with commas)</small><input data-f="attr" maxlength="60" value="${esc(p.attr)}" placeholder="e.g. S, M, L"></label>
    </div>
    <button type="button" class="pcard__remove" data-remove aria-label="Remove product ${i + 1}">×</button>
  </article>`;

function syncCounter() {
  const valid = draft.catalog.products.filter((p) => p.name.trim() && Number(p.price) > 0).length;
  const total = draft.catalog.products.length;
  const el = $('#counter');
  el.textContent = `${valid} ready · ${total} of ${MAX_PRODUCTS} products${valid < MIN_PRODUCTS ? ` (need at least ${MIN_PRODUCTS})` : ''}`;
  el.classList.toggle('is-bad', valid < MIN_PRODUCTS);
  $('#add-product').disabled = total >= MAX_PRODUCTS;
  // The blocking message is stale once enough products are ready.
  if (valid >= MIN_PRODUCTS && step === 2 && !errEl.hidden) showError('');
}
function syncCatalog() {
  const c = draft.catalog;
  $$('.niche').forEach((n) => n.setAttribute('aria-pressed', String(n.dataset.niche === c.niche || (n.dataset.niche === '_blank' && !c.niche && c.products.length > 0))));
  $('#f-attrlabel').value = c.attrLabel || '';
  $('#f-attrsel').checked = !!c.attrSelectable;
  $('#products').innerHTML = c.products.map(productHTML).join('');
  $('#cats').innerHTML = [...new Set(c.products.map((p) => p.category).filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join('');
  syncCounter();
}
$('#f-attrlabel').addEventListener('input', (e) => { draft.catalog.attrLabel = e.target.value; draft.catalog.dirty = true; $$('[data-attrname]').forEach((s) => { s.textContent = e.target.value || 'Option'; }); save(); });
$('#f-attrsel').addEventListener('change', (e) => { draft.catalog.attrSelectable = e.target.checked; draft.catalog.dirty = true; save(); });
$('#add-product').addEventListener('click', () => {
  if (draft.catalog.products.length >= MAX_PRODUCTS) return;
  draft.catalog.products.push(blankProduct(draft.catalog.products.length)); draft.catalog.dirty = true;
  syncCatalog(); save();
  $$('.pcard').at(-1).querySelector('[data-f=name]').focus();
});
$('#products').addEventListener('input', (e) => {
  const f = e.target.dataset.f; if (!f) return;
  const i = Number(e.target.closest('.pcard').dataset.i);
  draft.catalog.products[i][f] = e.target.value; draft.catalog.dirty = true;
  e.target.removeAttribute('aria-invalid');
  if (f === 'category') $('#cats').innerHTML = [...new Set(draft.catalog.products.map((p) => p.category).filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join('');
  syncCounter(); save();
});
$('#products').addEventListener('click', (e) => {
  const card = e.target.closest('.pcard'); if (!card) return;
  const i = Number(card.dataset.i);
  if (e.target.closest('[data-remove]')) { draft.catalog.products.splice(i, 1); draft.catalog.dirty = true; syncCatalog(); save(); }
  else if (e.target.closest('[data-photo-remove]')) { draft.catalog.products[i].photo = null; syncCatalog(); save(); }
});
$('#products').addEventListener('change', async (e) => {
  if (!e.target.matches('[data-photo]')) return;
  const i = Number(e.target.closest('.pcard').dataset.i);
  const file = e.target.files[0]; if (!file) return;
  try {
    const { url } = await shrink(file, { maxSide: 600, type: 'image/jpeg', quality: 0.78, fill: '#ffffff' });
    draft.catalog.products[i].photo = url; draft.catalog.dirty = true;
    showError(''); syncCatalog(); saveNow();
  } catch (err) { showError(err.message); }
});

// ---------- validation ----------
const errEl = $('#step-error');
function showError(msg) { errEl.textContent = msg; errEl.hidden = !msg; }
const bad = (el) => { el.setAttribute('aria-invalid', 'true'); el.focus(); };

function validate(i) {
  if (i === 0) {
    if (draft.brand.name.trim().length < 2) { showError('Add your store name to continue.'); bad($('#f-name')); return false; }
  } else if (i === 1) {
    const p = normalisePhone(draft.details.phone);
    if (p.length < 11 || p.length > 15) { showError('Add the WhatsApp or phone number orders should go to, e.g. 0712 345 678.'); bad($('#f-phone')); return false; }
  } else if (i === 2) {
    const products = draft.catalog.products;
    const valid = products.filter((p) => p.name.trim() && Number(p.price) > 0);
    if (valid.length < MIN_PRODUCTS) {
      showError(products.length ? `Each product needs a name and a price. You have ${valid.length} ready and need at least ${MIN_PRODUCTS}.` : `Pick a niche above to start, or add at least ${MIN_PRODUCTS} products.`);
      const firstBad = $$('.pcard').map((c) => [c, products[Number(c.dataset.i)]]).find(([, p]) => !p.name.trim() || !(Number(p.price) > 0));
      if (firstBad) bad(firstBad[0].querySelector(!firstBad[1].name.trim() ? '[data-f=name]' : '[data-f=price]'));
      return false;
    }
    // Unfinished rows would silently disappear from the store, so ask for them to be completed or removed.
    const partial = products.findIndex((p) => (p.name.trim() || p.price) && !(p.name.trim() && Number(p.price) > 0));
    if (partial >= 0) { showError(`Product ${partial + 1} is missing a name or price. Finish it or remove it.`); const c = $$('.pcard')[partial]; bad(c.querySelector(!products[partial].name.trim() ? '[data-f=name]' : '[data-f=price]')); return false; }
  }
  showError(''); return true;
}

// ---------- navigation ----------
const LABELS = ['Details', 'Catalog', 'Preview'];
function go(n) {
  step = n; maxStep = Math.max(maxStep, n);
  $$('.step').forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
  $$('#progress li').forEach((li, i) => {
    li.classList.toggle('is-current', i === n); li.classList.toggle('is-done', i < n);
    const b = $('button', li); if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  $('#bar-fill').style.width = `${((n + 1) / 4) * 100}%`;
  $('#back').hidden = n === 0;
  $('#next').hidden = n === 3;
  $('#next').textContent = `Continue to ${LABELS[n] || ''} →`;
  showError('');
  if (n === 0) syncBrand();
  if (n === 1) syncDetails();
  if (n === 2) syncCatalog();
  if (n === 3) renderPreview();
  saveNow();
  const h = $(`.step[data-step="${n}"] h1`); h.tabIndex = -1; h.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  history.replaceState(null, '', `#${['brand', 'details', 'catalog', 'preview'][n]}`);
}
function tryGo(n) {
  if (n <= step) return go(n);
  for (let i = step; i < n; i++) { if (!validate(i)) { if (i !== step) { go(i); validate(i); } return; } }
  go(n);
}
$('#next').addEventListener('click', () => tryGo(step + 1));
$('#back').addEventListener('click', () => go(step - 1));
document.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) tryGo(Number(b.dataset.goto)); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('input:not([type=file]):not([type=checkbox]):not([type=radio]):not([type=color])') && !e.target.closest('dialog') && step < 3) { e.preventDefault(); $('#next').click(); }
});

let resetTimer;
$('#start-over').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (b.dataset.armed) { try { localStorage.removeItem(KEY); } catch {} location.href = '/launch/'; return; }
  b.dataset.armed = '1'; b.textContent = 'Click again to erase your draft';
  clearTimeout(resetTimer); resetTimer = setTimeout(() => { delete b.dataset.armed; b.textContent = 'Start over'; }, 3500);
});

// ---------- step 4: preview ----------
let device = 'desktop';
function renderPreview() {
  saveNow();
  const url = `/store/?draft=local&t=${Date.now()}`;
  $('#preview').src = url;
  $('#frame-url').textContent = `${(draft.brand.name || 'yourstore').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourstore'}.dukabee.co.ke`;
  requestAnimationFrame(fit);
}
function fit() {
  const screen = $('#screen'), f = $('#preview');
  const w = screen.clientWidth, h = screen.clientHeight;
  if (!w) return;
  const width = device === 'mobile' ? w : Math.max(1200, w);
  const scale = Math.min(1, w / width);
  f.style.width = `${width}px`; f.style.height = `${h / scale}px`; f.style.transform = `scale(${scale})`;
}
new ResizeObserver(fit).observe(document.body);
$('#device').addEventListener('click', (e) => {
  const b = e.target.closest('[data-device]'); if (!b) return;
  device = b.dataset.device;
  $$('#device [data-device]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  $('#frame-wrap').classList.toggle('is-mobile', device === 'mobile');
  fit();
});

// ---------- intent capture ----------
const dlg = $('#lead'), leadForm = $('#lead-form');
const leadErr = $('#lead-error');
$('#want-btn').addEventListener('click', () => {
  leadForm.name.value = leadForm.name.value || '';
  leadForm.phone.value = leadForm.phone.value || draft.details.phone;
  leadForm.storeName.value = draft.brand.name;
  $('#lead-fields').hidden = false; $('#lead-done').hidden = true; leadErr.hidden = true;
  dlg.showModal(); leadForm.name.focus();
});
$('#lead-close').addEventListener('click', () => dlg.close());
$('#done-close').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

const draftForLead = () => {
  let s = JSON.stringify(draft);
  if (s.length > 1_400_000) s = JSON.stringify({ ...draft, catalog: { ...draft.catalog, products: draft.catalog.products.map((p) => ({ ...p, photo: null })) } });
  return s;
};

leadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(leadForm);
  const name = String(f.get('name') || '').trim(), phone = String(f.get('phone') || '').trim();
  leadErr.hidden = true;
  const fail = (msg, field) => { leadErr.innerHTML = esc(msg); leadErr.hidden = false; if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); } };
  leadForm.name.removeAttribute('aria-invalid'); leadForm.phone.removeAttribute('aria-invalid');
  if (name.length < 2) return fail('Please add your name.', leadForm.name);
  const p = normalisePhone(phone);
  if (p.length < 11 || p.length > 15) return fail('Please add a valid phone or WhatsApp number.', leadForm.phone);

  const btn = $('#lead-submit'); btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const res = await fetch('/api/leads', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, phone: p, storeName: String(f.get('storeName') || '').trim(), bestTime: f.get('bestTime'), wantsAddons: !!f.get('wantsAddons'), website: f.get('website'), draft: draftForLead() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) { const err = new Error(data.error || 'Something went wrong.'); err.field = data.field; throw err; }
    const store = String(f.get('storeName') || '').trim() || draft.brand.name;
    $('#done-msg').textContent = `Thanks ${name.split(' ')[0]}! Your request for "${store}" is in. Activation is ${ACTIVATION_FEE}, with your domain and hosting included. Someone will follow up on ${phone}${f.get('bestTime') !== 'Anytime' ? ` in the ${String(f.get('bestTime')).toLowerCase()}` : ''} to complete it.`;
    $('#lead-fields').hidden = true; $('#lead-done').hidden = false;
    $('#lead-done h2').tabIndex = -1; $('#lead-done h2').focus();
  } catch (err) {
    const wa = `https://wa.me/${CONTACT_WA}?text=${encodeURIComponent(`Hi Duka Bee, I want to activate my store "${draft.brand.name}". My name is ${name}, ${phone}.`)}`;
    leadErr.innerHTML = `${esc(err.message || "We couldn't send that.")} You can also <a href="${wa}" target="_blank" rel="noopener">message us on WhatsApp</a>.`;
    leadErr.hidden = false;
  } finally { btn.disabled = false; btn.textContent = 'Send my request'; }
});

// ---------- start ----------
const startAt = ({ brand: 0, details: 1, catalog: 2 })[location.hash.slice(1)] ?? 0;
syncBrand(); syncDetails(); syncCatalog();
go(0);
if (startAt > 0) tryGo(startAt);
