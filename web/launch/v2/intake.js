// Intake v2 (dukabee-v2-spec.md Phase 1): 3-step flow + live phone-frame preview + domain claim.
// Domain availability checking is intentionally NOT implemented here (no registrar credentials exist yet -
// see docs/v2-mapping.md); candidates are offered as plain, unchecked choices, never marked "available".
import { emptyDraft, productFromTemplate, normalisePhone } from '/lib/launch/store.mjs';
import { NICHES, NICHE_IDS } from '/lib/launch/niches.mjs';
import { CONTACT_WA, ACTIVATION_FEE } from '/lib/launch/config.mjs';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const track = (name, params) => window.dukabeeTrack && window.dukabeeTrack(name, { variant: 'v2', ...params });

const COLOURS = [
  { id: 'honey', name: 'Honey & ink', hex: '#c9971f' },
  { id: 'sukuma', name: 'Sukuma green', hex: '#2f6b45' },
  { id: 'ocean', name: 'Ocean', hex: '#0f6b8f' },
  { id: 'rose', name: 'Rose', hex: '#b03a5b' },
  { id: 'lavender', name: 'Lavender', hex: '#6b4fbb' },
  { id: 'coffee', name: 'Coffee', hex: '#5a3825' },
];
const POLICIES = ['Delivery in Nairobi', 'Countrywide delivery', 'Pickup point', 'Pay on delivery', 'M-Pesa accepted', 'Returns within 7 days', 'Exchange only'];
const DEFAULT_POLICIES = ['M-Pesa accepted'];

// ---------- draft (same localStorage key/shape the current intake and /store/ already use) ----------
const KEY = 'dukabee:draft:local';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
let draft = loadSaved();
const hadSaved = !!(draft && draft.v === 1 && (draft.brand?.name || draft.catalog?.niche));
if (!draft || draft.v !== 1) draft = emptyDraft();
draft.brand.markStyle = 'initials'; // v2's no-logo fallback is the coloured badge, not plain wordmark text

// v2-only bookkeeping not part of the shared draft shape: which of the 3 product slots are the seller's own.
let ownProducts = [{ name: '', price: '', photo: null }, { name: '', price: '', photo: null }, { name: '', price: '', photo: null }];

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(draft)); }
    catch { try { localStorage.setItem(KEY, JSON.stringify({ ...draft, catalog: { ...draft.catalog, products: draft.catalog.products.map((p) => ({ ...p, photo: null })) } })); } catch {} }
  }, 150);
}

if (hadSaved) {
  $('#returning').hidden = false;
  $('#start-fresh').addEventListener('click', () => { localStorage.removeItem(KEY); location.reload(); });
}

// ---------- catalog: own products first, niche samples fill the rest (tagged "Sample") ----------
function syncCatalog() {
  const niche = NICHES[draft.catalog.niche];
  const own = ownProducts
    .filter((p) => p.name.trim() && Number(p.price) > 0)
    .map((p, i) => ({ id: `own-${i}`, name: p.name.trim(), price: p.price, category: niche?.products[i]?.category || '', attr: '', description: '', photo: p.photo, sample: false }));
  const fillers = niche ? niche.products.slice(0, Math.max(0, 5 - own.length)).map((t, i) => ({ ...productFromTemplate(t, 100 + i), sample: true })) : [];
  draft.catalog.products = [...own, ...fillers];
  draft.catalog.attrLabel = niche?.attr.label || 'Option';
  draft.catalog.attrSelectable = !!niche?.attr.selectable;
  save();
  renderPreview();
  renderStrength();
}

// ---------- preview (same renderer /launch/ already uses: a store composed live from the draft) ----------
const frame = $('#preview-frame'), frameFs = $('#preview-frame-fs');
let previewStarted = false;
function renderPreview() {
  if (!draft.brand.name && !draft.catalog.niche) return; // nothing to show yet
  const url = `/store/?draft=local&t=${Date.now()}`;
  frame.src = url;
  if ($('#fs').classList.contains('is-open')) frameFs.src = url;
  if (!previewStarted) { previewStarted = true; track('intake_view'); }
}

// ---------- step 1: niche tiles ----------
const nicheGrid = $('#niche-grid');
nicheGrid.innerHTML = NICHE_IDS.map((id) => `<button type="button" class="v2-niche-tile" data-niche="${id}" aria-pressed="${draft.catalog.niche === id}">
  <span class="v2-niche-tile__emoji">${NICHES[id].emoji}</span>${esc(NICHES[id].label)}</button>`).join('');
nicheGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-niche]'); if (!btn) return;
  draft.catalog.niche = btn.dataset.niche;
  $$('.v2-niche-tile', nicheGrid).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  $('#skip-niche').hidden = false;
  renderHeadlineChips();
  syncCatalog();
});
$('#skip-to-claim').addEventListener('click', () => { track('skip_to_claim'); goStep(3); });

// ---------- step 2: products ----------
const fieldsEl = $('#product-fields');
fieldsEl.innerHTML = [0, 1, 2].map((i) => `<div class="v2-product-field" data-i="${i}">
  <div class="v2-product-field__head"><b>Product ${i + 1}</b><span class="v2-product-field__tag" data-tag="${i}"></span></div>
  <div class="row">
    <label>Name<input data-field="name" data-i="${i}" maxlength="60"></label>
    <label>Price (KSh)<input data-field="price" data-i="${i}" inputmode="numeric" pattern="[0-9]*"></label>
  </div>
  <label>Photo <small>(optional)</small><input type="file" accept="image/*" data-field="photo" data-i="${i}"></label>
</div>`).join('');
function refreshProductPlaceholders() {
  const niche = NICHES[draft.catalog.niche];
  [0, 1, 2].forEach((i) => {
    const t = niche?.products[i];
    $(`[data-field=name][data-i="${i}"]`, fieldsEl).placeholder = t ? `e.g. ${t.name}` : 'e.g. Denim jacket';
    $(`[data-field=price][data-i="${i}"]`, fieldsEl).placeholder = t ? `e.g. ${t.price}` : 'e.g. 3500';
    $(`[data-tag="${i}"]`, fieldsEl).textContent = ownProducts[i].name.trim() && Number(ownProducts[i].price) > 0 ? '' : 'Sample until filled';
  });
}
async function loadImage(file) { return new Promise((resolve, reject) => { const url = URL.createObjectURL(file); const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); resolve(img); }; img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); }; img.src = url; }); }
async function shrink(file, { maxSide, type, quality, fill }) {
  const img = await loadImage(file);
  const w0 = img.naturalWidth || 300, h0 = img.naturalHeight || 300;
  const k = Math.min(1, maxSide / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * k)); canvas.height = Math.max(1, Math.round(h0 * k));
  const ctx = canvas.getContext('2d');
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
}
fieldsEl.addEventListener('input', (e) => {
  const f = e.target.dataset.field, i = Number(e.target.dataset.i);
  if (!f || f === 'photo') return;
  ownProducts[i][f] = e.target.value;
  refreshProductPlaceholders(); syncCatalog();
});
fieldsEl.addEventListener('change', async (e) => {
  if (e.target.dataset.field !== 'photo') return;
  const i = Number(e.target.dataset.i), file = e.target.files[0]; if (!file) return;
  ownProducts[i].photo = await shrink(file, { maxSide: 520, type: 'image/jpeg', quality: 0.78, fill: '#ffffff' });
  syncCatalog();
});

// ---------- headline + suggestion chips ----------
function renderHeadlineChips() {
  const niche = NICHES[draft.catalog.niche];
  const el = $('#headline-chips');
  el.innerHTML = (niche?.headlines || []).map((h) => `<button type="button" class="v2-chip" data-headline="${esc(h)}">${esc(h)}</button>`).join('');
}
$('#headline-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-headline]'); if (!b) return;
  $('#headline').value = b.dataset.headline; draft.details.headline = b.dataset.headline; save(); renderPreview();
});
$('#headline').addEventListener('input', (e) => { draft.details.headline = e.target.value; save(); renderPreview(); renderStrength(); });

// ---------- logo ----------
$('#logoFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  draft.brand.logo = await shrink(file, { maxSide: 200, type: 'image/png' });
  draft.brand.mode = 'logo';
  $('#logo-note').hidden = false; $('#logo-note').textContent = 'Logo added.';
  save(); syncCatalog(); renderStrength();
});

// ---------- colour presets ----------
const colourGrid = $('#colour-grid');
colourGrid.innerHTML = COLOURS.map((c) => `<button type="button" class="v2-colour-swatch" data-colour="${c.id}" aria-pressed="false">
  <span class="v2-colour-swatch__dot" style="background:${c.hex}"></span><span class="name">${esc(c.name)}</span></button>`).join('');
colourGrid.addEventListener('click', (e) => {
  const b = e.target.closest('[data-colour]'); if (!b) return;
  const c = COLOURS.find((x) => x.id === b.dataset.colour);
  draft.brand.primary = c.hex; draft.brand.mode = draft.brand.mode === 'logo' ? 'logo' : 'kit'; draft.brand.vibe = 'clean';
  $$('.v2-colour-swatch', colourGrid).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  save(); syncCatalog();
});

// ---------- policy pills ----------
const policyRow = $('#policy-row');
policyRow.innerHTML = POLICIES.map((p) => `<button type="button" class="v2-chip" role="checkbox" aria-checked="${DEFAULT_POLICIES.includes(p)}" data-policy="${esc(p)}">${esc(p)}</button>`).join('');
draft.details.policy = [...DEFAULT_POLICIES];
policyRow.addEventListener('click', (e) => {
  const b = e.target.closest('[data-policy]'); if (!b) return;
  const on = b.getAttribute('aria-checked') !== 'true';
  b.setAttribute('aria-checked', String(on));
  draft.details.policy = $$('[data-policy]', policyRow).filter((x) => x.getAttribute('aria-checked') === 'true').map((x) => x.dataset.policy);
  save(); syncCatalog();
});

// ---------- location / name ----------
$('#location').addEventListener('input', (e) => { draft.details.location = e.target.value; save(); renderPreview(); renderStrength(); });
$('#contactName').addEventListener('input', (e) => { draft.details.contactName = e.target.value; save(); });
$('#shopName').addEventListener('input', (e) => { draft.brand.name = e.target.value; e.target.removeAttribute('aria-invalid'); save(); syncCatalog(); });

// ---------- steps ----------
const steps = $$('.v2-step');
let current = 1, started = false, startedAt = null;
function markStarted() { if (started) return; started = true; startedAt = Date.now(); track('intake_started'); }
['shopName', 'location'].forEach((id) => $(`#${id}`).addEventListener('focus', markStarted, { once: true }));
nicheGrid.addEventListener('click', markStarted, { once: true });

function paintStep() {
  steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== current; });
  $$('[data-dot]').forEach((d) => { const n = Number(d.dataset.dot); d.classList.toggle('is-current', n === current); d.classList.toggle('is-done', n < current); });
  $('#progress').setAttribute('aria-valuenow', current);
  if (current === 3) renderSummary();
}
function goStep(n) {
  track('step_completed', { step: current, ms: startedAt ? Date.now() - startedAt : 0 });
  current = n; paintStep();
}
$$('[data-next]').forEach((b) => b.addEventListener('click', () => {
  if (current === 1 && !draft.brand.name.trim()) { $('#shopName').setAttribute('aria-invalid', 'true'); $('#shopName').focus(); return; }
  goStep(Math.min(3, current + 1));
}));
$$('[data-back]').forEach((b) => b.addEventListener('click', () => goStep(Math.max(1, current - 1))));
$('[data-back-to]')?.addEventListener('click', (e) => goStep(Number(e.currentTarget.dataset.backTo)));
paintStep();

// ---------- summary (step 3) ----------
function renderSummary() {
  const niche = NICHES[draft.catalog.niche];
  const own = draft.catalog.products.filter((p) => !p.sample).length;
  $('#summary').innerHTML = `
    <p><b>${esc(draft.brand.name || 'Your shop')}</b> &middot; ${esc(niche?.label || 'No niche chosen')}</p>
    ${draft.details.location ? `<p>${esc(draft.details.location)}</p>` : ''}
    <p>${own} of your own product${own === 1 ? '' : 's'}, ${draft.catalog.products.length - own} sample${draft.catalog.products.length - own === 1 ? '' : 's'}</p>
    <p>${draft.details.policy.length} selling ${draft.details.policy.length === 1 ? 'detail' : 'details'} on</p>`;
}

// ---------- WhatsApp ----------
function validWhatsapp(v) { const n = normalisePhone(v); return n.length >= 11 && n.length <= 13 && /^254[17]/.test(n); }

// ---------- strength meter ----------
function computeStrength() {
  let s = 0;
  if (draft.brand.name.trim()) s += 15;
  if (draft.catalog.niche) s += 15;
  if (draft.details.location.trim()) s += 8;
  if (draft.details.headline.trim()) s += 8;
  if (draft.brand.mode === 'logo' && draft.brand.logo) s += 8;
  const own = draft.catalog.products.filter((p) => !p.sample);
  own.forEach((p) => { if (p.name && Number(p.price) > 0) { s += 8; if (p.photo) s += 4; } });
  if (draft.details.policy.length >= 2) s += 10;
  return Math.min(100, s);
}
function renderStrength() {
  const s = computeStrength();
  $('#strength-fill').style.width = `${s}%`;
  const [label, tip] = s < 40 ? ['A start', 'Next: pick what you sell.']
    : s < 70 ? ['Taking shape', 'Next: add one of your own products.']
    : s < 90 ? ['Looks like a real shop', 'Next: add a logo or a photo.']
    : ['Ready to sell', 'Looking good — claim it on WhatsApp.'];
  $('#strength-label').textContent = label; $('#strength-tip').textContent = tip;
}
renderStrength();

// ---------- domain candidates (no availability check - see docs/v2-mapping.md) ----------
function domainCandidates(name) {
  const base = String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim();
  const squashed = base.replace(/[\s-]+/g, '').slice(0, 63).replace(/^-+|-+$/g, '');
  const hyphenated = base.replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 63).replace(/^-+|-+$/g, '');
  const out = [];
  if (squashed) out.push(`${squashed}.co.ke`);
  if (hyphenated && hyphenated !== squashed) out.push(`${hyphenated}.co.ke`);
  if (squashed) out.push(`${squashed}ke.co.ke`);
  return [...new Set(out)].slice(0, 4);
}

// ---------- build + claim ----------
let chosenDomain = '';
$('#v2-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const wa = $('#whatsapp').value.trim();
  $('#whatsapp-err').hidden = true;
  if (!validWhatsapp(wa)) { $('#whatsapp-err').hidden = false; $('#whatsapp').focus(); return; }
  if (!$('#consent').checked) return;
  draft.details.phone = normalisePhone(wa);
  save();

  const btn = $('#build-btn'); btn.disabled = true; btn.textContent = 'Building…';
  const own = draft.catalog.products.filter((p) => !p.sample).length;
  track('build_clicked', { ms_total: startedAt ? Date.now() - startedAt : 0, own_products: own, has_logo: draft.brand.mode === 'logo' });

  let previewUrl = `${location.origin}/store/?draft=local`;
  try {
    const res = await fetch('/api/previews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draft }) });
    const data = await res.json();
    if (res.ok && data.id) previewUrl = `${location.origin}/preview/${data.id}`;
  } catch {} // the WhatsApp claim still works from this browser's own local preview if saving server-side fails

  const candidates = domainCandidates(draft.brand.name);
  chosenDomain = candidates[0] || 'yourshop.co.ke';
  $('#domain-chips').innerHTML = candidates.map((d, i) => `<button type="button" class="v2-domain-chip" data-domain="${esc(d)}" aria-pressed="${i === 0}">${esc(d)}</button>`).join('');
  $('#done-domain').textContent = chosenDomain;
  $('#price-copy').textContent = `${ACTIVATION_FEE} to go live: your domain, hosting and setup included.`;
  const builtMs = startedAt ? Date.now() - startedAt : 0;
  $('#built-chip').textContent = `Built in ${Math.floor(builtMs / 60000)}m ${Math.round((builtMs % 60000) / 1000)}s`;
  updateClaimCta(previewUrl, builtMs);

  $('#v2-form').hidden = true; $('#done').hidden = false;
  track('intake_view', { step: 'done' });
});

function updateClaimCta(previewUrl, builtMs) {
  const niche = NICHES[draft.catalog.niche];
  const msg = [
    'Hi Duka Bee! I’d like to claim my store.',
    `Shop: ${draft.brand.name}`,
    `Domain: ${chosenDomain}`,
    `Selling: ${niche?.label || '-'}`,
    `Location: ${draft.details.location || '-'}`,
    `My products added: ${draft.catalog.products.filter((p) => !p.sample).length}`,
    `Colours: ${COLOURS.find((c) => c.hex === draft.brand.primary)?.name || 'Duka Bee default'}`,
    `How I sell: ${draft.details.policy.join(', ') || '-'}`,
    `Preview: ${previewUrl}`,
    `Built in: ${Math.floor(builtMs / 60000)}m ${Math.round((builtMs % 60000) / 1000)}s`,
  ].join('\n');
  $('#claim-cta').href = `https://wa.me/${CONTACT_WA}?text=${encodeURIComponent(msg)}`;
  $('#claim-cta').dataset.previewUrl = previewUrl;
}
$('#domain-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-domain]'); if (!b) return;
  chosenDomain = b.dataset.domain;
  $$('.v2-domain-chip', $('#domain-chips')).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  $('#done-domain').textContent = chosenDomain;
  updateClaimCta($('#claim-cta').dataset.previewUrl || `${location.origin}/store/?draft=local`, 0);
});
$('#claim-cta').addEventListener('click', () => track('claim_clicked', { domain: chosenDomain }));
$('#try-store').addEventListener('click', () => window.open($('#claim-cta').dataset.previewUrl || '/store/?draft=local', '_blank', 'noopener'));
$('#make-changes').addEventListener('click', () => { $('#done').hidden = true; $('#v2-form').hidden = false; goStep(1); });

// ---------- mobile full-screen preview ----------
const fs = $('#fs');
$('#see-store').addEventListener('click', () => { fs.hidden = false; fs.classList.add('is-open'); frameFs.src = frame.src || '/store/?draft=local'; });
$('#fs-close').addEventListener('click', () => { fs.classList.remove('is-open'); fs.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fs.classList.contains('is-open')) $('#fs-close').click(); });

// ---------- initial paint from any restored draft ----------
if (draft.catalog.niche) {
  $(`.v2-niche-tile[data-niche="${draft.catalog.niche}"]`)?.setAttribute('aria-pressed', 'true');
  $('#skip-niche').hidden = false;
  renderHeadlineChips();
}
if (draft.brand.name) $('#shopName').value = draft.brand.name;
if (draft.details.location) $('#location').value = draft.details.location;
if (draft.details.headline) $('#headline').value = draft.details.headline;
refreshProductPlaceholders();
syncCatalog();
