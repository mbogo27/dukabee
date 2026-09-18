// Duka Bee Studio — drives the headless pipeline over SSE and previews the generated sites.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = { demos: [], current: 'kladi', tab: 'preview', device: 'desktop', page: 'index.html', compareKind: 'home', running: false };
const DEVICE_WIDTH = { desktop: 1280, tablet: 820, mobile: 376 };

// ---------- data ----------
async function loadDemos() {
  state.demos = await (await fetch('/api/demos')).json();
  renderStores();
}
const demo = (id = state.current) => state.demos.find((d) => d.id === id);
const ago = (iso) => {
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : new Date(iso).toLocaleDateString();
};

// ---------- store cards ----------
function renderStores() {
  $('#stores').innerHTML = state.demos.map((d) => {
    const m = d.manifest;
    const c = m?.theme.color;
    const status = state.running === d.id ? ['Generating…', 'run'] : m ? [`Built ${ago(m.generatedAt)}`, 'ok'] : ['Not built', ''];
    return `<button class="store" role="radio" aria-checked="${d.id === state.current}" data-demo="${d.id}">
      <span class="store__name">${esc(d.name)}</span>
      <span class="store__status ${status[1] ? 'store__status--' + status[1] : ''}">${status[0]}</span>
      <span class="store__vertical">${esc(d.vertical)} · ${esc(d.descriptor || '')}</span>
      ${c ? `<span class="store__swatches" aria-hidden="true">${['paper', 'soft', 'accent', 'highlight', 'ink'].map((k) => `<span style="background:${c[k]}"></span>`).join('')}</span>` : ''}
      <span class="store__stats">${m ? `<span><b>${m.counts.products}</b> products</span><span><b>${m.counts.pages}</b> pages</span><span><b>${m.findings.length}</b> findings</span>` : `<span><b>${d.sourceProducts}</b> source products</span>`}</span>
    </button>`;
  }).join('');
  $('#gen-one').textContent = `Generate ${demo()?.name || ''}`;
}

$('#stores').addEventListener('click', (e) => {
  const card = e.target.closest('[data-demo]');
  if (!card || state.running) return;
  select(card.dataset.demo);
});
$('#stores').addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp'].includes(e.key) || state.running) return;
  e.preventDefault();
  const ids = state.demos.map((d) => d.id);
  const next = ids[(ids.indexOf(state.current) + (e.key === 'ArrowDown' ? 1 : ids.length - 1)) % ids.length];
  select(next); $(`[data-demo=${next}]`).focus();
});

function select(id) {
  if (state.current !== id) state.page = 'index.html';
  state.current = id;
  renderStores();
  resetSteps(demo().manifest);
  renderAll();
}

// ---------- pipeline run ----------
function resetSteps(manifest) {
  $$('#steps li').forEach((li) => {
    li.className = '';
    $('em', li).textContent = '';
    $('time', li).textContent = '';
    if (manifest?.stageTimes?.[li.dataset.stage] != null) { li.classList.add('is-done'); $('time', li).textContent = `${manifest.stageTimes[li.dataset.stage]}ms`; }
  });
  $('#run-meta').textContent = manifest ? `last run ${ago(manifest.generatedAt)}` : '';
}

const logEl = $('#log');
const log = (text, cls = '') => {
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = text;
  logEl.append(line);
  logEl.scrollTop = logEl.scrollHeight;
};

function generate(which) {
  if (state.running) return;
  const buttons = [$('#gen-one'), $('#gen-all')];
  buttons.forEach((b) => { b.disabled = true; });
  logEl.textContent = '';
  const es = new EventSource(`/api/generate?demo=${which}`);
  const t0 = performance.now();
  es.onmessage = (msg) => {
    const e = JSON.parse(msg.data);
    if (e.type === 'begin') {
      state.running = e.demo;
      if (state.current !== e.demo) { state.current = e.demo; state.page = 'index.html'; }
      renderStores(); resetSteps(null);
      $$('#steps li').forEach((li) => { li.className = ''; });
      log(`▸ ${demo(e.demo).name}`, 'l-stage');
      showEmpty(false);
    } else if (e.type === 'stage') {
      const li = $(`#steps li[data-stage=${e.stage}]`);
      if (e.status === 'running') { li.className = 'is-running'; log(`  ${e.message}…`, 'l-dim'); }
      else { li.className = 'is-done'; $('em', li).textContent = e.summary; $('time', li).textContent = `${e.ms}ms`; log(`  ✓ ${e.stage} — ${e.summary}`, 'l-ok'); }
    } else if (e.type === 'log') {
      log(`    ${e.message}`);
    } else if (e.type === 'complete') {
      const d = demo(e.demo); d.manifest = e.manifest;
      state.running = false; renderStores();
      renderAll();
    } else if (e.type === 'end' || e.type === 'error') {
      if (e.type === 'error') log(`✗ ${e.message}`, 'l-err');
      else log(`Done in ${((performance.now() - t0) / 1000).toFixed(1)}s. Headless: no editor step.`, 'l-stage');
      es.close(); state.running = false; buttons.forEach((b) => { b.disabled = false; }); renderStores();
      $('#run-meta').textContent = 'just now';
    }
  };
  es.onerror = () => { es.close(); state.running = false; buttons.forEach((b) => { b.disabled = false; }); log('Connection lost. Is the studio server still running?', 'l-err'); };
}
$('#gen-one').addEventListener('click', () => generate(state.current));
$('#gen-all').addEventListener('click', () => generate('all'));

// ---------- tabs ----------
$('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  state.tab = b.dataset.tab;
  $$('.tabs [data-tab]').forEach((t) => t.setAttribute('aria-selected', t === b));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== state.tab; });
  renderAll();
});

function renderAll() {
  const m = demo()?.manifest;
  $('#findings-count').textContent = m ? m.findings.filter((f) => f.severity === 'gap' || f.severity === 'conflict').length || '' : '';
  if (state.tab === 'preview') renderPreview();
  if (state.tab === 'compare') renderCompare();
  if (state.tab === 'brand') renderBrand();
  if (state.tab === 'vault') renderVault();
  if (state.tab === 'findings') renderFindings();
}

// ---------- preview ----------
function showEmpty(on) { $('#preview-empty').hidden = !on; $('#browser').hidden = on; }

function renderPreview() {
  const m = demo()?.manifest;
  if (!m) { showEmpty(true); $('#page-select').innerHTML = ''; return; }
  showEmpty(false);
  const opts = m.pages.map((p) => `<option value="${esc(p.path)}">${p.kind === 'home' ? 'Home' : p.kind === 'shop' ? 'Shop' : '  ' + esc(p.title)}</option>`);
  const sel = $('#page-select');
  sel.innerHTML = `${opts[0]}${opts[1]}<optgroup label="Products (${m.pages.length - 2})">${opts.slice(2).join('')}</optgroup>`;
  if (!m.pages.some((p) => p.path === state.page)) state.page = 'index.html';
  sel.value = state.page;
  const src = `/sites/${m.demo}/${state.page}`;
  const frame = $('#frame');
  if (frame.dataset.src !== src) { frame.dataset.src = src; frame.src = src; }
  $('#open-tab').href = src;
  $('#browser-url').textContent = `${m.demo}.dukabee.shop/${state.page === 'index.html' ? '' : state.page.replace(/\.html$/, '')}`;
  fitFrame();
}

$('#page-select').addEventListener('change', (e) => { state.page = e.target.value; renderPreview(); });
$('#device').addEventListener('click', (e) => {
  const b = e.target.closest('[data-device]');
  if (!b) return;
  state.device = b.dataset.device;
  $$('#device button').forEach((x) => x.setAttribute('aria-checked', x === b));
  $('#browser').className = `browser is-${state.device}`;
  fitFrame();
});
$('#reset-cart').addEventListener('click', () => {
  try { $('#frame').contentWindow.localStorage.removeItem(`dukabee:${state.current}:cart`); } catch {}
  $('#frame').contentWindow.location.reload();
});

// Track navigation inside the iframe so the page picker follows clicks in the generated site.
$('#frame').addEventListener('load', () => {
  try {
    const loc = $('#frame').contentWindow.location.pathname;
    const m = loc.match(/^\/sites\/\w+\/(.*)$/);
    if (m) {
      const page = m[1] || 'index.html';
      state.page = page; $('#frame').dataset.src = loc;
      if ($('#page-select').querySelector(`option[value="${CSS.escape(page)}"]`)) $('#page-select').value = page;
      $('#browser-url').textContent = `${state.current}.dukabee.shop/${page === 'index.html' ? '' : page.replace(/\.html$/, '')}`;
      $('#open-tab').href = loc;
    }
  } catch {}
});

// Render the site at a real device width and scale it to fit the frame.
function scaleInto(screen, iframe, width) {
  const w = screen.clientWidth, h = screen.clientHeight;
  if (!w) return;
  const scale = Math.min(1, w / width);
  iframe.style.width = `${width}px`;
  iframe.style.height = `${h / scale}px`;
  iframe.style.transform = `scale(${scale})`;
}
function fitFrame() {
  const width = state.device === 'desktop' ? Math.max(1280, $('#screen').clientWidth) : DEVICE_WIDTH[state.device];
  scaleInto($('#screen'), $('#frame'), width);
}
new ResizeObserver(() => { fitFrame(); $$('.compare__screen').forEach((s) => scaleInto(s, $('iframe', s), 1280)); }).observe(document.body);

// ---------- compare ----------
$('#compare-kind').addEventListener('click', (e) => {
  const b = e.target.closest('[data-kind]');
  if (!b) return;
  state.compareKind = b.dataset.kind;
  $$('#compare-kind button').forEach((x) => x.setAttribute('aria-checked', x === b));
  renderCompare();
});

async function comparePage(d) {
  const m = d.manifest;
  if (state.compareKind === 'home') return { path: 'index.html', label: 'Home' };
  if (state.compareKind === 'shop') return { path: 'shop.html', label: 'Shop' };
  // A product that exercises selectors when the store has any, else the first product.
  const vault = await (await fetch(`/api/vault/${d.id}`)).json();
  const withChoice = vault.products.find((p) => p.attributes.filter((a) => a.selectable).length > 1) || vault.products.find((p) => p.attributes.some((a) => a.selectable));
  const p = withChoice || vault.products[0];
  return { path: `product/${p.slug}.html`, label: p.name + (withChoice ? '' : ' (no choices in this catalog)') };
}

async function renderCompare() {
  const wrap = $('#compare');
  const cols = await Promise.all(state.demos.map(async (d) => {
    if (!d.manifest) return `<div class="compare__col"><div class="compare__head"><b>${esc(d.name)}</b></div><div class="compare__screen"><div class="compare__missing">Not generated yet</div></div></div>`;
    const pg = await comparePage(d);
    return `<div class="compare__col"><div class="compare__head"><b>${esc(d.name)}</b><span title="${esc(pg.label)}">${esc(pg.label)}</span></div><div class="compare__screen"><iframe src="/sites/${d.id}/${pg.path}" title="${esc(d.name)} ${esc(pg.label)}" loading="lazy"></iframe></div></div>`;
  }));
  wrap.innerHTML = cols.join('');
  $$('.compare__screen', wrap).forEach((s) => { const f = $('iframe', s); if (f) scaleInto(s, f, 1280); });
}

// ---------- brand.md ----------
function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>'); }
function renderMarkdown(md) {
  const out = []; let table = null; let list = false;
  const flush = () => { if (list) { out.push('</ul>'); list = false; } if (table) { out.push(`<table><thead><tr>${table[0].map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${table.slice(1).map((r) => `<tr>${r.map((c) => `<td>${/^#[0-9a-f]{6}$/i.test(c) ? `<span class="dot" style="background:${c}"></span>` : ''}${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); table = null; } };
  for (const line of md.split(/\r?\n/)) {
    if (/^\|/.test(line)) { if (list) flush(); if (/^\|[-| ]+\|$/.test(line)) continue; (table ||= []).push(line.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))); continue; }
    if (table) flush();
    if (/^# /.test(line)) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (/^## /.test(line)) { flush(); out.push(`<h2>${inline(line.slice(3))}</h2>`); }
    else if (/^- /.test(line)) { if (!list) { out.push('<ul>'); list = true; } const m = line.slice(2).match(/^([\w. ]+): (.*)$/); out.push(`<li>${m ? `<span class="k">${esc(m[1])}</span> ${inline(m[2])}` : inline(line.slice(2))}</li>`); }
    else if (line.trim()) { flush(); out.push(`<p>${inline(line)}</p>`); }
  }
  flush();
  return out.join('');
}
async function renderBrand() {
  const d = demo();
  if (!d.manifest) { $('#brand-md').innerHTML = '<p>Generate this store to write its brand.md.</p>'; $('#swatches').innerHTML = ''; return; }
  const md = await (await fetch(`/api/artifact/${d.id}/brand.md`)).text();
  $('#brand-md').innerHTML = renderMarkdown(md);
  const c = d.manifest.theme.color;
  $('#swatches').innerHTML = Object.entries(c).map(([k, v]) => `<div class="swatch"><i style="background:${v}"></i><b>${esc(k)}</b><code>${esc(v)}</code></div>`).join('');
}

// ---------- vault ----------
async function renderVault() {
  const d = demo();
  if (!d.manifest) { $('#vault-head').innerHTML = ''; $('#vault-table').innerHTML = '<tr><td>Generate this store to build its vault.</td></tr>'; return; }
  const v = await (await fetch(`/api/vault/${d.id}`)).json();
  const m = d.manifest;
  $('#vault-head').innerHTML = [
    [v.products.length, 'product entities'],
    [m.filterable.join(', ') || '—', 'filterable → shop facets'],
    [m.selectable.join(', ') || 'none', 'selectable → product selectors'],
    [m.counts.withChoice, 'products gate Add to Cart'],
    [m.counts.assumed, 'products with assumed values'],
  ].map(([b, s]) => `<div class="kpi"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
  const rows = v.products.sort((a, b) => a.name.localeCompare(b.name)).map((p) => `<tr>
    <td><img src="/sites/${d.id}/${esc(p.image)}" alt="" loading="lazy"></td>
    <td><a class="pname" href="#" data-open="product/${esc(p.slug)}.html">${esc(p.name)}</a><span class="psrc">${p.provenance.sourceSlugs.length > 1 ? `merged from ${p.provenance.sourceSlugs.length} listings` : `source: ${esc(p.sourceName)}`}</span></td>
    <td class="price">KSh ${p.price.toLocaleString('en-KE')}</td>
    <td><div class="attrs">${p.attributes.map((a) => `<span class="attr${a.assumed ? ' attr--assumed' : ''}" title="${esc(a.evidence)}">${a.filterable ? '<span class="chip chip--f">F</span>' : ''}${a.selectable ? '<span class="chip chip--s">S</span>' : ''}${!a.filterable && !a.selectable ? '<span class="chip chip--none">·</span>' : ''}<b>${esc(a.label)}</b> ${esc(a.values.map((x) => x.value + (x.priceDelta ? ` (+${x.priceDelta})` : '')).join(' / '))}</span>`).join('')}</div></td>
  </tr>`).join('');
  $('#vault-table').innerHTML = `<thead><tr><th></th><th>Product</th><th>Price</th><th>Attributes (hover for evidence)</th></tr></thead><tbody>${rows}</tbody>`;
}
$('#vault-table').addEventListener('click', (e) => {
  const a = e.target.closest('[data-open]');
  if (!a) return;
  e.preventDefault();
  state.page = a.dataset.open;
  $('.tabs [data-tab=preview]').click();
});

// ---------- findings ----------
const SEV = { conflict: 'Conflicts', gap: 'Gaps', decision: 'Mapping decisions', note: 'Notes' };
function renderFindings() {
  const m = demo()?.manifest;
  if (!m) { $('#findings').innerHTML = '<p>Generate this store to see its findings.</p>'; return; }
  const groups = Object.keys(SEV).map((sev) => [sev, m.findings.filter((f) => f.severity === sev)]).filter(([, l]) => l.length);
  $('#findings').innerHTML = `<div class="fsummary">${groups.map(([sev, l]) => `<div class="kpi"><b>${l.length}</b><span>${SEV[sev].toLowerCase()}</span></div>`).join('')}</div>` +
    groups.map(([sev, list]) => `<section class="fgroup"><h3>${SEV[sev]} <small>${list.length}</small></h3>${list.map((f) => `<div class="finding sev-${sev}"><span class="src">${esc(f.from)}</span><p>${inline(f.text)}</p></div>`).join('')}</section>`).join('');
}

loadDemos().then(() => { resetSteps(demo().manifest); renderAll(); });
