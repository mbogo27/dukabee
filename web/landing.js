import { NICHES } from '/lib/launch/niches.mjs';
import { CONTACT_WA } from '/lib/launch/config.mjs';

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

// Openly browsable sample stores: one per niche, each with its own random look.
$('#sample-links').innerHTML = Object.entries(NICHES).map(([id, n], i) => {
  const params = new URLSearchParams({ name: `${n.label} Demo`, wa: CONTACT_WA, cat: id, seed: `demo${i + 1}` });
  return `<a href="/store/?${params}"><span aria-hidden="true">${n.emoji}</span>${n.label}</a>`;
}).join('');

// Proof-of-work showcase: the three pipeline-built demos.
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
