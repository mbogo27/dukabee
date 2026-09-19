// Kiwanda web-mode runtime — binds section-level behaviour: cart state + overlay, pre-checkout form →
// WhatsApp, attribute-selector gating on product pages, and the shop filter control.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const base = document.body.dataset.base || '';
  const cartEl = $('[data-cart]');
  if (!cartEl) return;
  const shopId = cartEl.dataset.shop;
  const shopName = cartEl.dataset.shopName;
  const whatsapp = cartEl.dataset.whatsapp;
  const KEY = `dukabee:${shopId}:cart`;
  const ksh = (n) => `KSh ${Number(n).toLocaleString('en-KE')}`;
  const asset = (p) => (/^(https?:|data:|\/)/.test(p) ? p : base + p);

  // ---- cart state (client-side only; persists across pages within the session) ----
  let memory = [];
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return memory; } };
  const write = (lines) => { memory = lines; try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {} render(); };
  const lineKey = (slug, sel) => slug + '|' + Object.entries(sel || {}).map(([k, v]) => `${k}=${v}`).join('&');

  const add = (item) => {
    const lines = read();
    const key = lineKey(item.slug, item.selections);
    const found = lines.find((l) => l.key === key);
    if (found) found.qty += 1; else lines.push({ ...item, key, qty: 1 });
    write(lines);
  };
  const update = (key, fn) => write(read().map((l) => (l.key === key ? fn(l) : l)).filter((l) => l && l.qty > 0));

  // ---- overlay rendering ----
  const tpl = $('#kw-cart-line');
  const render = () => {
    const lines = read();
    const count = lines.reduce((n, l) => n + l.qty, 0);
    $$('[data-cart-count]').forEach((b) => { b.textContent = count; b.hidden = count === 0; });
    const list = $('[data-lines]', cartEl);
    list.replaceChildren(...lines.map((l) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.key = l.key;
      const img = $('[data-slot=image]', node); img.src = asset(l.image); img.alt = '';
      $('[data-slot=name]', node).textContent = l.name;
      const attrs = Object.entries(l.selections || {}).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`).join(' · ');
      const attrsEl = $('[data-slot=attrs]', node); attrsEl.textContent = attrs; attrsEl.hidden = !attrs;
      $('[data-slot=qty]', node).textContent = l.qty;
      $('[data-slot=total]', node).textContent = ksh(l.price * l.qty);
      return node;
    }));
    const empty = lines.length === 0;
    $('[data-cart-empty]', cartEl).hidden = !empty;
    $('[data-cart-foot]', cartEl).hidden = empty;
    $('[data-cart-total]', cartEl).textContent = ksh(lines.reduce((s, l) => s + l.price * l.qty, 0));
    if (empty) showView('cart');
  };

  let lastFocus = null;
  const showView = (name) => $$('[data-view]', cartEl).forEach((v) => { v.hidden = v.dataset.view !== name; });
  const open = (view = 'cart') => {
    lastFocus = document.activeElement;
    showView(view); cartEl.hidden = false; document.body.classList.add('kw-locked');
    requestAnimationFrame(() => cartEl.classList.add('is-open'));
    (view === 'checkout' ? $('[name=customerName]', cartEl) : $('.kw-close', cartEl)).focus();
  };
  const close = () => {
    cartEl.classList.remove('is-open'); document.body.classList.remove('kw-locked');
    setTimeout(() => { cartEl.hidden = true; }, 180);
    lastFocus?.focus?.();
  };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cart-open],[data-cart-close],[data-checkout-open],[data-checkout-back],[data-quick-add],[data-act]');
    if (!t) return;
    if (t.matches('[data-cart-open]')) open();
    else if (t.matches('[data-cart-close]')) close();
    else if (t.matches('[data-checkout-open]')) { showView('checkout'); $('[name=customerName]', cartEl).focus(); }
    else if (t.matches('[data-checkout-back]')) { e.preventDefault(); showView('cart'); }
    else if (t.matches('[data-quick-add]')) {
      add({ slug: t.dataset.quickAdd, name: t.dataset.name, price: Number(t.dataset.price), image: t.dataset.image, selections: {} });
      if (t.hasAttribute('data-buy')) open('checkout'); else toast(`Added ${t.dataset.name}`);
    } else if (t.matches('[data-act]')) {
      const key = t.closest('[data-key]').dataset.key;
      const act = t.dataset.act;
      update(key, (l) => (act === 'remove' ? null : { ...l, qty: l.qty + (act === 'inc' ? 1 : -1) }));
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cartEl.hidden) close(); });

  // Pre-checkout form → structured WhatsApp message.
  $('[data-checkout-form]', cartEl).addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const f = new FormData(form);
    const lines = read();
    const body = lines.map((l) => {
      const sel = Object.entries(l.selections || {}).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`).join(', ');
      return `${l.name}${sel ? `\n${sel}` : ''}\nQty: ${l.qty} · ${ksh(l.price * l.qty)}`;
    }).join('\n\n');
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const msg = `Hello ${shopName}!\n\nI'd like to order:\n\n${body}\n\nTotal: ${ksh(total)}\n\nName: ${f.get('customerName')}\nDelivery area: ${f.get('deliveryArea')}\nPreferred delivery: ${f.get('preferredDelivery')}${f.get('notes') ? `\nNotes: ${f.get('notes')}` : ''}\n\n[ref: ${shopId}-cart-checkout]`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  let toastTimer;
  const toast = (text) => {
    const el = $('[data-toast]');
    el.innerHTML = '';
    el.append(text + ' — ');
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'View cart'; btn.dataset.cartOpen = '';
    el.append(btn);
    el.hidden = false; el.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.classList.remove('is-on'); setTimeout(() => { el.hidden = true; }, 200); }, 2600);
  };

  window.addEventListener('storage', (e) => { if (e.key === KEY) render(); });
  render();

  // ---- product detail: attribute selectors gate Add to Cart ----
  const pdp = $('[data-pdp]');
  if (pdp) {
    const selectors = $$('.kw-selector', pdp);
    const btns = $$('[data-add-to-cart],[data-buy-now]', pdp);
    const hint = $('[data-pdp-hint]', pdp);
    const priceEl = $('[data-pdp-price]', pdp);
    const img = $('[data-pdp-image]');
    const basePrice = Number(pdp.dataset.price);
    let image = pdp.dataset.image;
    const state = () => {
      const sel = {}; let delta = 0; const missing = [];
      selectors.forEach((fs) => {
        const checked = $('input:checked', fs);
        const label = $('legend', fs).firstChild.textContent.trim();
        $('[data-chosen]', fs).textContent = checked ? `· ${checked.value}` : '';
        if (checked) { sel[fs.dataset.attr] = checked.value; delta += Number(checked.dataset.priceDelta || 0); }
        else missing.push(label.toLowerCase());
      });
      return { sel, price: basePrice + delta, missing };
    };
    const sync = (e) => {
      const s = state();
      btns.forEach((b) => { b.disabled = s.missing.length > 0; });
      hint.textContent = s.missing.length ? `Choose ${s.missing.join(' and ')} to continue` : '';
      priceEl.textContent = ksh(s.price);
      const src = e?.target?.dataset?.image;
      if (src && img) { img.src = src; image = e.target.dataset.imageRel; }
    };
    pdp.addEventListener('change', sync);
    pdp.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = state();
      if (s.missing.length) return sync();
      add({ slug: pdp.dataset.pdp, name: pdp.dataset.name, price: s.price, image, selections: s.sel });
      // Buy Now = Add to Cart + open the cart straight at the pre-checkout form.
      if (e.submitter?.value === 'buy') open('checkout'); else toast(`Added ${pdp.dataset.name}`);
    });
    sync();

    // Variable-length descriptions: clamp long copy with a Read more toggle instead of a hard cap.
    const desc = $('[data-desc]', pdp);
    const text = $('.kw-desc__text', desc);
    const toggle = $('[data-desc-toggle]', desc);
    if (text.scrollHeight > 190) {
      desc.classList.add('is-clamped'); toggle.hidden = false;
      toggle.addEventListener('click', () => {
        const clamped = desc.classList.toggle('is-clamped');
        toggle.textContent = clamped ? 'Read more' : 'Show less';
      });
    }
  }

  // ---- search (name + category) ----
  // Header search filters live on the shop page; on any other page it opens the shop with the query.
  const searchForm = $('[data-search-form]');
  const searchInput = searchForm && $('input', searchForm);
  const shopHref = $('[data-shop-link]')?.getAttribute('href') || 'shop.html';

  // ---- shop: search + filter control over filterable attributes + price range ----
  const filters = $('[data-filters]');
  if (!filters && searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      location.href = q ? `${shopHref}${shopHref.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}` : shopHref;
    });
  }
  if (filters) {
    const grid = $('#kw-shop-grid');
    const cards = $$('.kw-card', grid);
    const original = cards.slice();
    const empty = $('[data-empty]');
    const countEl = $('[data-result-count]');
    const activeEl = $('[data-filter-active]');
    const sortEl = $('[data-sort]');
    const details = $('details', filters);
    const minEl = $('[data-price-min]', filters);
    const maxEl = $('[data-price-max]', filters);
    if (matchMedia('(max-width: 820px)').matches) details.open = false;

    const facetKeys = $$('[data-facet]', filters).map((f) => f.dataset.facet).filter((k) => k !== '_price');
    const managed = [...facetKeys, 'q', 'min', 'max'];
    const params = new URLSearchParams(location.search);
    params.forEach((v, k) => { const box = $(`input[name="${CSS.escape(k)}"][value="${CSS.escape(v)}"]`, filters); if (box) box.checked = true; });
    if (params.get('q') && searchInput) searchInput.value = params.get('q');
    if (params.get('min')) minEl.value = params.get('min');
    if (params.get('max')) maxEl.value = params.get('max');

    const apply = () => {
      const chosen = {};
      $$('input[type=checkbox]:checked', filters).forEach((i) => (chosen[i.name] ||= []).push(i.value));
      const tokens = (searchInput?.value || '').toLowerCase().split(/\s+/).filter(Boolean);
      const min = minEl.value === '' ? -Infinity : Number(minEl.value);
      const max = maxEl.value === '' ? Infinity : Number(maxEl.value);
      let shown = 0;
      cards.forEach((card) => {
        const price = Number(card.dataset.price);
        const ok = tokens.every((t) => (card.dataset.search || '').includes(t))
          && price >= min && price <= max
          && Object.entries(chosen).every(([k, vals]) => {
            const have = (card.dataset[`f${k[0].toUpperCase()}${k.slice(1)}`] || '').split('|');
            return vals.some((v) => have.includes(v));
          });
        card.hidden = !ok; if (ok) shown++;
      });
      const n = Object.values(chosen).flat().length + (minEl.value !== '' || maxEl.value !== '' ? 1 : 0) + (tokens.length ? 1 : 0);
      activeEl.textContent = n ? `(${n})` : '';
      countEl.textContent = `${shown} of ${cards.length} products`;
      empty.hidden = shown > 0; grid.hidden = shown === 0;
      const q = new URLSearchParams(location.search);
      managed.forEach((k) => q.delete(k));
      Object.entries(chosen).forEach(([k, vals]) => vals.forEach((v) => q.append(k, v)));
      if (tokens.length) q.set('q', searchInput.value.trim());
      if (minEl.value !== '') q.set('min', minEl.value);
      if (maxEl.value !== '') q.set('max', maxEl.value);
      history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
    };
    const sort = () => {
      const mode = sortEl.value;
      const list = mode === 'featured' ? original : original.slice().sort((a, b) => (mode === 'price-asc' ? 1 : -1) * (a.dataset.price - b.dataset.price));
      grid.append(...list);
    };
    filters.addEventListener('change', apply);
    filters.addEventListener('input', (e) => { if (e.target.matches('[data-price-min],[data-price-max]')) apply(); });
    if (searchForm) {
      searchInput.addEventListener('input', apply);
      searchForm.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
    }
    sortEl.addEventListener('change', sort);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-filter-clear]')) return;
      $$('input[type=checkbox]:checked', filters).forEach((i) => { i.checked = false; });
      minEl.value = ''; maxEl.value = ''; if (searchInput) searchInput.value = '';
      apply();
    });
    apply();
  }
})();
