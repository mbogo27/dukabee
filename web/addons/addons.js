import { ADDONS, addonById } from '/lib/launch/addons.mjs';
import { CONTACT_WA } from '/lib/launch/config.mjs';

const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Picks are remembered in the browser and travel with the launch request (see /launch/).
const KEY = 'dukabee:addons';
const read = () => { try { return (JSON.parse(localStorage.getItem(KEY)) || []).filter((id) => addonById(id)); } catch { return []; } };
const write = (ids) => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {} };
let picked = read();

const ask = (a) => `https://wa.me/${CONTACT_WA}?text=${encodeURIComponent(`Hi Duka Bee, I'd like to ask about the "${a.title}" add-on (${a.price}).`)}`;
$('#custom-link').href = `https://wa.me/${CONTACT_WA}?text=${encodeURIComponent('Hi Duka Bee, I need something custom for my store.')}`;

$('#addon-grid').innerHTML = ADDONS.map((a) => `
  <article class="addon" data-id="${a.id}">
    <div class="addon__top"><span class="addon__icon" aria-hidden="true">${a.icon}</span>${a.tag ? `<span class="addon__tag">${esc(a.tag)}</span>` : ''}</div>
    <h2>${esc(a.title)}</h2>
    <p class="addon__price">${esc(a.price)}</p>
    <p class="addon__blurb">${esc(a.blurb)}</p>
    <p class="addon__use"><b>Good for:</b> ${esc(a.useCase.replace(/^For /, ''))}</p>
    <div class="addon__actions">
      <button type="button" class="btn" data-toggle aria-pressed="false"></button>
      <a class="addon__ask" href="${ask(a)}" target="_blank" rel="noopener">Ask on WhatsApp ↗</a>
    </div>
  </article>`).join('');

function render() {
  document.querySelectorAll('.addon').forEach((card) => {
    const on = picked.includes(card.dataset.id);
    card.classList.toggle('is-picked', on);
    const b = $('[data-toggle]', card);
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? '✓ Added to my request' : '+ Add to my request';
  });
  // If a store draft exists, the next step is going back to it; otherwise start one.
  let hasDraft = false;
  try { const d = JSON.parse(localStorage.getItem('dukabee:draft:local') || 'null'); hasDraft = !!(d && d.catalog && d.catalog.products.length); } catch {}
  const n = picked.length;
  $('#pick-text').innerHTML = n
    ? `${n} add-on${n > 1 ? 's' : ''} selected<small>${picked.map((id) => esc(addonById(id).title)).join(', ')}</small>`
    : 'No add-ons selected<small>They\'re all optional.</small>';
  const go = $('#pick-go');
  go.textContent = hasDraft ? 'Back to my store preview →' : 'Launch your store →';
  go.href = hasDraft ? '/launch/#preview' : '/launch/';
}

$('#addon-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-toggle]'); if (!b) return;
  const id = b.closest('.addon').dataset.id;
  picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
  write(picked); render();
});
window.addEventListener('storage', (e) => { if (e.key === KEY) { picked = read(); render(); } });
render();
