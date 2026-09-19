import { NICHES } from '/lib/launch/niches.mjs';
import { CONTACT_WA } from '/lib/launch/config.mjs';
import { draftFromQuery, buildVault } from '/lib/launch/store.mjs';

const $ = (s, r = document) => r.querySelector(s);

$('#contact').href = `https://wa.me/${CONTACT_WA}?text=${encodeURIComponent('Hi Duka Bee, I would like an online shop for my business.')}`;

// Hero form: carry the store name and WhatsApp number into the launch flow (plain GET, so it works without JS too).
$('#launch').addEventListener('submit', (e) => {
  e.preventDefault();
  const params = new URLSearchParams();
  const name = $('#launch [name=name]').value.trim();
  const wa = $('#launch [name=wa]').value.trim();
  if (name) params.set('name', name);
  if (wa) params.set('wa', wa);
  location.href = params.size ? `/launch/?${params}` : '/launch/';
});

// Openly browsable sample stores: one card per niche. No photos: each card carries that store's own colour
// palette and niche icon, and opens the same generated store the launch flow would build.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('#sample-links').innerHTML = Object.entries(NICHES).map(([id, n], i) => {
  const params = new URLSearchParams({ name: `${n.label} Demo`, wa: CONTACT_WA, cat: id, seed: `demo${i + 1}` });
  const { shop, products } = buildVault(draftFromQuery(params));
  const c = shop.theme.color;
  return `<a class="store-card" href="/store/?${params}" data-track="sample_store_click" data-track-niche="${id}" aria-label="Open the ${esc(n.label)} sample store">
    <div class="store-card__hero" style="--c-paper:${c.paper}" aria-hidden="true">
      <span class="store-card__emoji">${n.emoji}</span>
      <span class="store-card__dots">${[c.accent, c.ink, c.highlight, c.soft].map((col) => `<i style="background:${col}"></i>`).join('')}</span>
    </div>
    <div class="store-card__body">
      <h3>${esc(n.label)}</h3>
      <p>${esc(n.hero)}</p>
      <div class="store-card__meta"><span>${products.length} products</span><span class="store-card__cta">Open store ↗</span></div>
    </div>
  </a>`;
}).join('');

// Proof-of-work showcase: the three pipeline-built demos.
fetch('/demos/demos.json').then((r) => r.json()).then((demos) => {
  $('#showcase').innerHTML = demos.map((d) => `
    <a class="shop-card" href="/demos/${d.id}/" data-track="demo_store_click" data-track-demo="${d.id}">
      <div class="shop-card__img">${d.images.map((src) => `<img src="${src}" alt="" loading="lazy">`).join('')}</div>
      <div class="shop-card__body">
        <h3>${d.name}</h3>
        <p>${d.vertical} · ${d.tagline}</p>
        <div class="shop-card__meta"><span>${d.products} products · ${d.pages} pages</span><span class="swatch">${d.colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span></div>
      </div>
    </a>`).join('');
}).catch(() => { $('#showcase').innerHTML = '<p>Examples are unavailable right now.</p>'; });
