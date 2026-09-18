import { readConfig, buildVault, storeUrl, newSeed, CATALOGS } from '/lib/launch/dummy.mjs';

// Duka Bee's own WhatsApp for the "talk to us" CTA — change here.
const CONTACT_WA = '254743747496';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const form = $('#launch');
let cfg = null;
let device = 'desktop';

$('#contact').href = `https://wa.me/${CONTACT_WA}?text=${encodeURIComponent('Hi Duka Bee, I would like an online shop for my business.')}`;

// ---- intake modes: dummy data is live; website + Instagram are visible but stubbed ----
$('.modes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b) return;
  $$('.modes [data-mode]').forEach((x) => x.setAttribute('aria-selected', x === b));
  $$('.mode-panel').forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.mode; });
  $('#generate').textContent = b.dataset.mode === 'dummy' ? 'Generate my store' : 'Use sample products instead';
});

const showError = (msg, field) => {
  const el = $('#form-error');
  el.textContent = msg; el.hidden = !msg;
  $$('.field input').forEach((i) => i.removeAttribute('aria-invalid'));
  if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  // Catalog-upload / IG modes fall back to the sample-products panel.
  if ($('[data-panel=dummy]').hidden) { $('.modes [data-mode=dummy]').click(); form.name.focus(); return; }
  const name = form.name.value.trim();
  const digits = form.wa.value.replace(/[^0-9]/g, '');
  if (!name) return showError('Add your shop name.', form.name);
  if (digits.length < 9) return showError('Add a WhatsApp number, e.g. 0712 345 678.', form.wa);
  showError('');
  cfg = readConfig(new URLSearchParams({ name, wa: digits, cat: form.cat.value, seed: newSeed() }));
  show();
});

$('#reroll').addEventListener('click', () => { cfg = { ...cfg, seed: newSeed() }; show(); });
$('#copy').addEventListener('click', async () => {
  const url = location.origin + storeUrl(cfg);
  try { await navigator.clipboard.writeText(url); $('#copy').textContent = 'Link copied ✓'; }
  catch { prompt('Copy this link:', url); }
  setTimeout(() => { $('#copy').textContent = 'Copy link'; }, 2000);
});
$('.device').addEventListener('click', (e) => {
  const b = e.target.closest('[data-device]');
  if (!b) return;
  device = b.dataset.device;
  $$('.device [data-device]').forEach((x) => x.setAttribute('aria-checked', x === b));
  $('#frame-wrap').classList.toggle('is-mobile', device === 'mobile');
  fit();
});

function show() {
  const { look } = buildVault(cfg);
  const url = storeUrl(cfg);
  $('#result').hidden = false;
  $('#result-title').textContent = `Here's ${cfg.name}`;
  $('#look').innerHTML = `${CATALOGS[cfg.cat].label} · <b>${look.palette}</b> palette · <b>${look.font}</b> · ${look.shape} · ${look.hero === 'hero-photo-stat' ? 'stat hero' : 'photo hero'}`;
  $('#open').href = url;
  $('#frame-url').textContent = `${location.host}${url.split('?')[0]}`;
  $('#preview').src = url;
  fit();
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Render the store at real device width, scaled to fit the frame.
function fit() {
  const screen = $('#screen'); const f = $('#preview');
  const w = screen.clientWidth, h = screen.clientHeight;
  if (!w) return;
  const width = device === 'mobile' ? w : Math.max(1200, w);
  const scale = Math.min(1, w / width);
  f.style.width = `${width}px`; f.style.height = `${h / scale}px`; f.style.transform = `scale(${scale})`;
}
new ResizeObserver(fit).observe(document.body);

// ---- proof-of-work showcase ----
fetch('/demos/demos.json').then((r) => r.json()).then((demos) => {
  $('#showcase').innerHTML = demos.map((d) => `
    <a class="shop-card" href="/demos/${d.id}/">
      <div class="shop-card__img">${d.images.map((src) => `<img src="${src}" alt="" loading="lazy">`).join('')}</div>
      <div class="shop-card__body">
        <h3>${d.name}</h3>
        <p>${d.vertical} · ${d.tagline}</p>
        <div class="shop-card__meta"><span>${d.products} products · ${d.pages} pages</span><span class="swatch">${d.colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span></div>
      </div>
    </a>`).join('');
}).catch(() => { $('#showcase').innerHTML = '<p>Examples are unavailable right now.</p>'; });
