// Storefront v2 pages: one pure-ish composition from a CatalogSource + ContentSource to static files.
//   /                 homepage from composeHomepage
//   /shop             faceted catalog (filters run client-side over an inline, cost-free index)
//   /p/<slug>         product pages (in and out of stock; a URL is never removed)
//   /guides, /guides/<slug>   articles with live product embeds
// Returns { files: [{ path, content }], warnings, errors }. Errors mean the build must fail.
import { esc, routes, waHref, imageRef, priceTag, productCard, nameParts, configLine, cartData, fill, jsonScript } from './ui.mjs';
import { header, footer, cartDrawer, renderHomeSections } from './sections.mjs';
import { composeHomepage } from './compose.mjs';
import { publicProduct, indexEntry, buildFacets, facetCounts, results, emptyQuery, parseRange, inRange, formatKsh, attr1, SORTS, visibleFacetKeys } from './catalog.mjs';
import { inline, plainText, slugify } from './markdown.mjs';

const EMBEDS = { product: 'slug', products: 'slugs', compare: 'slugs' };
const EMBED_LIMITS = { product: [1, 1], products: [2, 4], compare: [2, 3] };
const fmtDate = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00+03:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' });
const ld = (data) => jsonScript(null, data, 'application/ld+json');
const truncate = (s, n) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`; };

export async function composeStorefront({ catalog, content, relFile = (f) => f, now = new Date() }) {
  const warnings = [], errors = [];
  const store = await catalog.getStore();
  const models = new Map((await catalog.listModels()).map((m) => [m.modelId, m]));
  // Images are keyed by model (one photo set covers every configuration), so pages read them from the registry.
  const products = (await catalog.listProducts()).map((p) => ({ ...publicProduct(p), images: models.get(p.modelId)?.images || p.images }));
  const categories = await catalog.listCategories();
  const banners = await catalog.listBanners();
  const defs = await catalog.listAttributes();
  const buckets = await catalog.listPriceBuckets();
  const guides = content ? await content.listGuides() : [];
  const origin = `https://${store.domain || store.previewDomain}`;
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const inStock = products.filter((p) => p.stock !== 'out');
  const noun = store.nouns || { one: 'product', many: 'products' };
  const ctx = { store, models, categories, defs, buckets, origin };
  const productUrl = (p) => `${origin}${routes.product(p.slug)}`;

  // ---- relations ----
  const siblingsOf = (p) => products.filter((x) => x.modelId === p.modelId && x.slug !== p.slug && x.stock !== 'out').sort((a, b) => a.price - b.price);
  const relatedOf = (p, n = 4) => {
    const pool = inStock.filter((x) => x.categoryId === p.categoryId && x.modelId !== p.modelId);
    const near = (a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price);
    const within = pool.filter((x) => Math.abs(x.price - p.price) <= p.price * 0.2).sort(near);
    return [...within, ...pool.filter((x) => !within.includes(x)).sort(near)].slice(0, n);
  };

  // ---- guides: validate embeds (unknown slug = error with file:line), bands, stock and prices in prose ----
  const guideOf = new Map(); // product slug → guides that embed it
  for (const g of guides) {
    const file = relFile(g.file);
    g.embedded = [];
    for (const b of g.blocks) {
      if ((b.type === 'paragraph' || b.type === 'list') && /KSh\s*\d/.test(b.type === 'list' ? b.items.map((i) => i.text).join(' ') : b.text)) {
        warnings.push(`${file}:${b.line}: price in prose (prices go stale when stock or markup changes; put budgets in headings and let embeds show prices)`);
      }
      if (b.type !== 'directive') continue;
      if (!EMBEDS[b.name]) { errors.push(`${file}:${b.line}: unknown directive "::${b.name}" (use ::product, ::products or ::compare)`); continue; }
      const slugs = String(b.attrs[EMBEDS[b.name]] || '').split(',').map((s) => s.trim()).filter(Boolean);
      const [min, max] = EMBED_LIMITS[b.name];
      if (slugs.length < min || slugs.length > max) errors.push(`${file}:${b.line}: ::${b.name} takes ${min === max ? min : `${min}–${max}`} product${max > 1 ? 's' : ''}, got ${slugs.length}`);
      b.products = [];
      for (const slug of slugs) {
        const p = bySlug.get(slug);
        if (!p) { errors.push(`${file}:${b.line}: unknown product slug "${slug}" in ::${b.name}`); continue; }
        b.products.push(p);
        if (!g.embedded.includes(p)) g.embedded.push(p);
        if (!guideOf.has(slug)) guideOf.set(slug, []);
        if (!guideOf.get(slug).includes(g)) guideOf.get(slug).push(g);
        if (b.attrs.band) {
          const r = parseRange(b.attrs.band);
          if (!r) errors.push(`${file}:${b.line}: band "${b.attrs.band}" should look like 25000-35000 or 45000-`);
          else if (!inRange(p.price, r)) warnings.push(`${file}:${b.line}: ${slug} is now ${formatKsh(p.price)}, outside its band ${b.attrs.band}. Re-pick this embed.`);
        }
        if (p.stock === 'out') warnings.push(`${file}:${b.line}: ${slug} is out of stock; the embed shows "See similar".`);
      }
    }
  }

  // ---- shell ----
  // Product photos: one image, or a swipeable strip with thumbnails. A borrowed (stand-in) photo says so.
  const gallery = (images = [], title) => {
    const shots = images.length ? images : [null];
    const note = shots[0]?.standIn ? `<p class="sf-gallery__note">Photo shows a similar model (${esc(models.get(shots[0].standIn)?.name || 'same family')}). Ask us on WhatsApp for photos of this exact unit.</p>` : '';
    if (shots.length === 1) return imageRef(shots[0], { eager: true, alt: title, cls: 'sf-pdp__img' }) + note;
    return `<div class="sf-gallery" data-gallery><div class="sf-gallery__track" data-gallery-track tabindex="0" role="group" aria-label="${esc(title)} photos">${shots.map((img, i) => `<figure class="sf-gallery__slide">${imageRef(img, { eager: i === 0, alt: `${title}, photo ${i + 1} of ${shots.length}`, cls: 'sf-pdp__img' })}</figure>`).join('')}</div>
<div class="sf-gallery__thumbs">${shots.map((img, i) => `<button type="button" data-gallery-to="${i}" aria-label="Show photo ${i + 1} of ${shots.length}"${i ? '' : ' aria-current="true"'}>${imageRef(img, { alt: '' })}</button>`).join('')}</div></div>${note}`;
  };

  const shell = ({ kind, title, description, canonical, body, top = '', jsonld = [], robots, ogType = 'website', image }) => `<!doctype html>
<html lang="en-KE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n` : ''}${robots ? `<meta name="robots" content="${robots}">\n` : ''}<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(store.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">\n` : ''}${image ? `<meta property="og:image" content="${esc(image)}">\n` : ''}<meta name="theme-color" content="${esc(store.palette.primary)}">
<meta name="generator" content="Duka Bee · Kiwanda storefront v2">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(store.fonts?.display || 'Space Grotesk').replace(/%20/g, '+')}:wght@400;500;700&family=${encodeURIComponent(store.fonts?.mono || 'JetBrains Mono').replace(/%20/g, '+')}:wght@400;600&display=swap">
<link rel="stylesheet" href="/assets/storefront.css">
<style>:root{--ink:${store.palette.primary};--accent:${store.palette.accent};--paper:${store.palette.paper || '#ffffff'};--font-display:'${store.fonts?.display || 'Space Grotesk'}';--font-mono:'${store.fonts?.mono || 'JetBrains Mono'}'}</style>
${jsonld.map(ld).join('\n')}
</head>
<body class="sf sf-page--${kind}">
<a class="sf-skip" href="#main">Skip to content</a>
${top}${header({ store, current: kind })}
<main id="main">${body}</main>
${footer({ store, categories, guides })}
${cartDrawer({ store })}
${jsonScript('sf-config', { id: store.id, name: store.name, whatsapp: store.whatsapp, origin, checkout: store.checkout, nouns: noun })}
<script type="module" src="/assets/storefront.js"></script>
</body>
</html>
`;

  const files = [];
  const page = (path, html) => files.push({ path, content: html });

  // ---- home ----
  const homeReport = {};
  const sections = composeHomepage(store, { products, categories, banners, attributes: defs, priceBuckets: buckets, guides, tiers: store.tiers, now }, homeReport);
  const home = renderHomeSections(sections, ctx);
  page('index.html', shell({
    kind: 'home', title: store.seo.homeTitle, description: store.seo.homeDescription, canonical: `${origin}/`, top: home.top, body: home.main,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Organization', name: store.name, url: `${origin}/`, telephone: `+${store.whatsapp}`, contactPoint: { '@type': 'ContactPoint', telephone: `+${store.whatsapp}`, contactType: 'sales', areaServed: 'KE' } },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: store.name, url: `${origin}/`, potentialAction: { '@type': 'SearchAction', target: `${origin}/shop?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
    ],
  }));

  // ---- shop ----
  const index = products.map((p) => indexEntry(p, models.get(p.modelId), defs));
  const facets = buildFacets(index, defs, buckets);
  const q0 = emptyQuery();
  const counts = facetCounts(index, q0, facets, { termsOf: (p) => p.terms });
  const visible = visibleFacetKeys(index, q0, facets);
  const initial = results(index, q0, { termsOf: (p) => p.terms }).map((e) => e.slug);
  const ordered = [...initial.map((s) => bySlug.get(s)), ...products.filter((p) => !initial.includes(p.slug))];
  const facetHtml = facets.map((f, i) => {
    const def = defs.find((d) => d.key === f.key);
    const display = f.display || 'checkbox';
    return `<details class="sf-facet" data-facet="${esc(f.key)}"${i < 6 ? ' open' : ''}${visible.includes(f.key) ? '' : ' hidden'}>
<summary>${esc(f.label)}<span class="sf-facet__n" data-facet-n></span></summary>
${def?.explainer ? `<p class="sf-facet__hint">${esc(def.explainer)}</p>` : ''}<div class="sf-facet__values sf-facet__values--${display}">${f.values.map((v) => {
      const n = counts[f.key]?.[v.value] || 0;
      return `<label class="sf-opt"><input type="checkbox" name="${esc(f.key)}" value="${esc(v.value)}"${n ? '' : ' disabled'}><span class="sf-opt__label">${esc(v.label)}</span><span class="sf-opt__count" data-count>${n}</span></label>`;
    }).join('')}</div></details>`;
  }).join('\n');
  const catCount = (id) => counts.category?.[id] || 0;
  const shopBody = `<section class="sf-section sf-shop" data-shop><div class="sf-wrap">
<div class="sf-shop__head"><h1>Shop ex-UK ${esc(noun.many)}</h1>
<form class="sf-shop__search" role="search" action="/shop" method="get" data-shop-search><label class="sf-sr" for="sf-shop-q">Search ${esc(noun.many)}</label><input id="sf-shop-q" type="search" name="q" placeholder="Model, processor or RAM, e.g. x390 or i7 16gb" autocomplete="off" enterkeyhint="search"></form></div>
<nav class="sf-catchips" aria-label="Category"><a href="/shop" data-category="" aria-current="true">All <small data-cat-count="">${inStock.length}</small></a>${categories.filter((c) => catCount(c.id)).map((c) => `<a href="/shop?category=${encodeURIComponent(c.id)}" data-category="${esc(c.id)}">${esc(c.name)} <small data-cat-count="${esc(c.id)}">${catCount(c.id)}</small></a>`).join('')}</nav>
<div class="sf-shop__bar">
<button type="button" class="sf-cta sf-cta--ghost sf-filters-btn" data-filters-open aria-controls="sf-filters">Filters <span data-filter-n></span></button>
<p class="sf-shop__count" data-result-count aria-live="polite">${inStock.length} ${esc(noun.many)}</p>
<label class="sf-sort"><span>Sort</span><select data-sort>${SORTS.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></label>
</div>
<div class="sf-active" data-active hidden></div>
<div class="sf-shop__layout">
<aside class="sf-filters" id="sf-filters" data-filters aria-label="Filters">
<div class="sf-filters__head"><h2>Filters</h2><button type="button" class="sf-close" data-filters-close aria-label="Close filters">×</button></div>
<div class="sf-filters__body">${facetHtml}</div>
<div class="sf-filters__foot"><button type="button" class="sf-textlink" data-clear>Clear all</button><button type="button" class="sf-cta" data-filters-close data-filters-apply>Show ${inStock.length} ${esc(noun.many)}</button></div>
</aside>
<div class="sf-shop__results">
<div class="sf-grid" id="sf-results">${ordered.map((p, i) => productCard(p, { model: models.get(p.modelId), eager: i < 4, headingLevel: 2, attrs: p.stock === 'out' ? { hidden: true } : {} })).join('')}</div>
<div class="sf-empty" data-empty hidden><h2>${esc(store.emptyState?.text || 'Nothing matches those filters.')}</h2><p><a class="sf-cta sf-cta--wa" data-sourcing href="${waHref(store.whatsapp)}" target="_blank" rel="noopener">${esc(store.emptyState?.cta || 'Ask us on WhatsApp')} ↗</a> <button type="button" class="sf-cta sf-cta--ghost" data-clear>Clear filters</button></p></div>
</div></div></div></section>
${jsonScript('sf-index', { facets, defs: defs.map(({ key, label, order, summary, valueSummaries }) => ({ key, label, order, summary, valueSummaries })), buckets, categories: categories.map(({ id, name }) => ({ id, name })), products: index, emptyMessage: store.emptyState?.message })}`;
  page('shop.html', shell({
    kind: 'shop', title: store.seo.shopTitle, description: fill(store.seo.shopDescription, { count: inStock.length }), canonical: `${origin}/shop`, body: shopBody,
  }));

  // ---- product pages ----
  const footnoteMark = '<abbr class="sf-approx" title="Typical for this model">≈</abbr>';
  for (const p of products) {
    const m = models.get(p.modelId);
    const { title, config } = nameParts(p, m);
    const out = p.stock === 'out';
    const cat = categories.find((c) => c.id === p.categoryId);
    const url = productUrl(p);
    const sibs = siblingsOf(p);
    const diffKeys = ['cpu', 'cpuGen', 'ram', 'storage', 'touch', 'gpuMemory', 'features'];
    const short = (k, v, other) => {
      if (k === 'cpu') return v.replace(/^Intel (Core )?|^AMD /, '');
      if (k === 'touch') return v === 'Yes' ? 'Touch' : 'No touch';
      if (k === 'gpuMemory') return v ? `${v} GPU` : 'No GPU';
      if (k === 'features') return v ? v.split(', ').map((f) => (f === 'Stylus pen' ? 'Pen' : f)).join(' + ') : `No ${other.split(', ').map((f) => (f === 'Stylus pen' ? 'pen' : f)).join(', ')}`;
      return v;
    };
    const chip = (s) => {
      const diffs = diffKeys.filter((k) => (s.attributes[k] || []).join(', ') !== (p.attributes[k] || []).join(', '))
        .map((k) => short(k, (s.attributes[k] || []).join(', '), (p.attributes[k] || []).join(', ')));
      return `<a class="sf-chip" href="${routes.product(s.slug)}"><span>${esc(diffs.join(' · ') || configLine(nameParts(s, m).config))}</span> <span class="sf-chip__price">— ${esc(formatKsh(s.price))}</span></a>`;
    };
    const specRows = defs.filter((d) => p.attributes[d.key]?.length).map((d) => {
      const v = p.attributes[d.key].join(', ');
      const hint = d.valueHints?.[v];
      return `<tr><th scope="row">${esc(d.label)}</th><td>${esc(v)}${p.inferred?.includes(d.key) ? ` ${footnoteMark}` : ''}${hint ? `<span class="sf-spec__hint">${esc(hint)}</span>` : ''}</td></tr>`;
    }).join('');
    const notes = (p.inferred || []).filter((k) => store.inferredNotes?.[k]).map((k) => `<p class="sf-footnote">${footnoteMark} ${esc(store.inferredNotes[k])}</p>`).join('');
    const anyInferred = (p.inferred || []).some((k) => p.attributes[k]);
    const askMsg = fill(store.messages.ask, { name: p.name, url });
    const reqMsg = fill(store.messages.request, { name: p.name, url, price: formatKsh(p.price) });
    const related = relatedOf(p);
    const inGuides = guideOf.get(p.slug) || [];
    const confirmed = store.policies || [];
    const body = `<div class="sf-wrap">
<nav class="sf-crumbs" aria-label="Breadcrumb"><a href="/shop">Shop</a> / <a href="/shop?category=${encodeURIComponent(p.categoryId)}">${esc(cat?.name || p.categoryId)}</a></nav>
<article class="sf-pdp${out ? ' is-out' : ''}" data-product="${esc(p.slug)}">
<div class="sf-pdp__media">${gallery(p.images, title)}</div>
<div class="sf-pdp__info">
<p class="sf-eyebrow">${esc([attr1(p, 'brand'), attr1(p, 'series'), attr1(p, 'formFactor')].filter(Boolean).join(' · '))}</p>
<h1 class="sf-pdp__title">${esc(title)}</h1>
<p class="sf-pdp__config">${esc(configLine(config))}</p>
<div class="sf-pdp__price">${priceTag(p.price, { out, size: 'sf-price--lg' })}</div>
<p class="sf-pdp__condition"><span>Condition: ${esc(attr1(p, 'condition') || store.condition)}</span> · <span class="${out ? 'sf-stock--out' : 'sf-stock--in'}">${out ? 'Out of stock' : 'In stock'}</span></p>
${sibs.length ? `<div class="sf-configs"><h2 class="sf-h3">Other configurations</h2><div class="sf-chips">${sibs.map(chip).join('')}</div></div>` : ''}
<div class="sf-pdp__ctas">${out
    ? `<a class="sf-cta sf-cta--wa" href="${waHref(store.whatsapp, reqMsg)}" target="_blank" rel="noopener" data-track="request_click">Request this ${esc(noun.one)} ↗</a>`
    : `<button type="button" class="sf-cta" ${Object.entries(cartData(p)).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>Add to cart</button><a class="sf-cta sf-cta--ghost" href="${waHref(store.whatsapp, askMsg)}" target="_blank" rel="noopener" data-track="ask_click">Ask about this ${esc(noun.one)} ↗</a>`}</div>
<div class="sf-pdp__desc"><p>${esc(p.description)}</p></div>
<h2 class="sf-h3">Specifications</h2>
<table class="sf-spec"><tbody>${specRows}</tbody></table>
${anyInferred ? `<p class="sf-footnote">${footnoteMark} ${esc(store.inferredFootnote)}</p>` : ''}${notes}
<div class="sf-policies"><h2 class="sf-h3">Buying from ${esc(store.name)}</h2><ul>${confirmed.map((t) => `<li>${esc(t)}</li>`).join('')}<li>We confirm availability, condition and battery health of the exact unit on WhatsApp before you pay.</li>${(store.policiesToConfirm || []).length ? '<li>Delivery, pickup and warranty: ask us on WhatsApp.</li>' : ''}</ul></div>
${inGuides.map((g) => `<p class="sf-pdp__guide"><a href="${routes.guide(g.slug)}">Read the guide: ${esc(g.title)} →</a></p>`).join('')}
</div></article></div>
${related.length ? `<section class="sf-section sf-related"><div class="sf-wrap"><div class="sf-section__head"><h2>You might also like</h2></div><div class="sf-grid sf-grid--rail">${related.map((r) => productCard(r, { model: models.get(r.modelId) })).join('')}</div></div></section>` : ''}`;
    page(`p/${p.slug}.html`, shell({
      kind: 'product', title: `${p.name}${store.seo.titleSuffix}`, description: truncate(p.description, 155), canonical: url, body, ogType: 'product', image: p.images?.[0]?.src ? origin + p.images[0].src : undefined,
      jsonld: [{
        '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.slug, url, ...(p.images?.some((i) => i.src) ? { image: p.images.filter((i) => i.src).map((i) => origin + i.src) } : {}),
        brand: { '@type': 'Brand', name: attr1(p, 'brand') }, model: m?.name || title, description: p.description, category: cat?.name,
        offers: {
          '@type': 'Offer', url, priceCurrency: 'KES', price: String(p.price),
          availability: out ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          itemCondition: `https://schema.org/${store.itemCondition || 'UsedCondition'}`,
          seller: { '@type': 'Organization', name: store.name },
        },
      }, {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Shop', item: `${origin}/shop` },
          { '@type': 'ListItem', position: 2, name: cat?.name || p.categoryId, item: `${origin}/shop?category=${encodeURIComponent(p.categoryId)}` },
          { '@type': 'ListItem', position: 3, name: title, item: url },
        ],
      }],
    }));
  }

  // ---- guides ----
  const embedCard = (p, g) => {
    const m = models.get(p.modelId), { title, config } = nameParts(p, m), out = p.stock === 'out';
    const track = (action) => `data-embed-action="${action}" data-guide="${esc(g.slug)}" data-embed-slug="${esc(p.slug)}"`;
    const similar = out ? relatedOf(p, 1)[0] : null;
    return `<article class="sf-embed${out ? ' is-out' : ''}">
<a class="sf-embed__media" href="${routes.product(p.slug)}" ${track('view')} tabindex="-1" aria-hidden="true">${imageRef(p.images?.[0], { alt: title })}</a>
<div class="sf-embed__body"><h3 class="sf-embed__title"><a href="${routes.product(p.slug)}" ${track('view')}>${esc(title)}</a></h3>
<p class="sf-mono sf-embed__config">${esc(configLine(config))}</p>
${priceTag(p.price, { out })}
<div class="sf-embed__ctas">${out
    ? `${similar ? `<a class="sf-cta" href="${routes.product(similar.slug)}" ${track('view')}>See similar</a>` : ''}<a class="sf-cta sf-cta--ghost" href="${waHref(store.whatsapp, fill(store.messages.request, { name: p.name, url: productUrl(p), price: formatKsh(p.price) }))}" target="_blank" rel="noopener" ${track('whatsapp')}>Request it ↗</a>`
    : `<button type="button" class="sf-cta" ${Object.entries(cartData(p)).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')} ${track('cart')}>Add to cart</button><a class="sf-cta sf-cta--ghost" href="${waHref(store.whatsapp, fill(store.messages.ask, { name: p.name, url: productUrl(p) }))}" target="_blank" rel="noopener" ${track('whatsapp')}>Ask on WhatsApp ↗</a>`}</div>
</div></article>`;
  };
  const compareTable = (ps, g) => {
    const rows = defs.filter((d) => ps.some((p) => p.attributes[d.key]?.length)).map((d) => {
      const vals = ps.map((p) => (p.attributes[d.key] || []).join(', '));
      const diff = new Set(vals).size > 1;
      return `<tr${diff ? ' class="is-diff"' : ''}><th scope="row">${esc(d.label)}</th>${ps.map((p, i) => `<td>${esc(vals[i] || '—')}${p.inferred?.includes(d.key) ? ` ${footnoteMark}` : ''}</td>`).join('')}</tr>`;
    }).join('');
    const track = (p, action) => `data-embed-action="${action}" data-guide="${esc(g.slug)}" data-embed-slug="${esc(p.slug)}"`;
    return `<div class="sf-compare" role="region" aria-label="Comparison of ${ps.length} ${esc(noun.many)}" tabindex="0"><table>
<thead><tr><th scope="col"><span class="sf-sr">Spec</span></th>${ps.map((p) => `<th scope="col"><a href="${routes.product(p.slug)}" ${track(p, 'view')}>${esc(nameParts(p, models.get(p.modelId)).title)}</a></th>`).join('')}</tr></thead>
<tbody><tr class="sf-compare__price"><th scope="row">Price</th>${ps.map((p) => `<td>${priceTag(p.price, { out: p.stock === 'out' })}</td>`).join('')}</tr>${rows}
<tr><th scope="row"><span class="sf-sr">Buy</span></th>${ps.map((p) => `<td>${p.stock === 'out' ? '<span class="sf-badge">Out of stock</span>' : `<button type="button" class="sf-cta sf-cta--sm" ${Object.entries(cartData(p)).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')} ${track(p, 'cart')}>Add to cart</button>`}</td>`).join('')}</tr>
</tbody></table></div><p class="sf-fine">Highlighted rows differ. ${footnoteMark} ${esc(store.inferredFootnote)}</p>`;
  };
  const renderBlock = (b, g) => {
    if (b.type === 'heading') { const lvl = Math.min(Math.max(b.level, 2), 4); return `<h${lvl} id="${slugify(b.text)}">${inline(b.text)}</h${lvl}>`; }
    if (b.type === 'paragraph') return `<p>${inline(b.text)}</p>`;
    if (b.type === 'list') return `<ul>${b.items.map((i) => `<li>${inline(i.text)}</li>`).join('')}</ul>`;
    if (b.type === 'directive' && b.products?.length) {
      if (b.name === 'product') return `<div class="sf-embeds sf-embeds--one" data-embed-block="product">${embedCard(b.products[0], g)}</div>`;
      if (b.name === 'products') return `<div class="sf-embeds sf-embeds--row" data-embed-block="products">${b.products.map((p) => embedCard(p, g)).join('')}</div>`;
      if (b.name === 'compare') return `<div class="sf-embeds" data-embed-block="compare">${compareTable(b.products, g)}</div>`;
    }
    return '';
  };
  for (const g of guides) {
    const url = `${origin}${routes.guide(g.slug)}`;
    const body = `<article class="sf-guide"><div class="sf-wrap sf-wrap--narrow">
<nav class="sf-crumbs" aria-label="Breadcrumb"><a href="/guides">Guides</a></nav>
<header class="sf-guide__head"><p class="sf-eyebrow">Buying guide</p><h1>${esc(g.title)}</h1><p class="sf-guide__lede">${esc(g.description || '')}</p><p class="sf-guide__meta">By ${esc(g.author || store.name)} · Updated <time datetime="${esc(g.updatedAt)}">${fmtDate(g.updatedAt)}</time></p></header>
<div class="sf-prose">${g.blocks.map((b) => renderBlock(b, g)).join('\n')}</div>
</div></article>`;
    page(`guides/${g.slug}.html`, shell({
      kind: 'guides', title: `${g.title}${store.seo.titleSuffix}`, description: g.description || truncate(plainText(g.blocks.find((b) => b.type === 'paragraph')?.text || ''), 155), canonical: url, body, ogType: 'article',
      jsonld: [{
        '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, datePublished: g.publishedAt, dateModified: g.updatedAt,
        author: { '@type': 'Organization', name: g.author || store.name, url: `${origin}/` }, publisher: { '@type': 'Organization', name: store.name, url: `${origin}/` }, mainEntityOfPage: url,
      }, {
        '@context': 'https://schema.org', '@type': 'ItemList', name: g.title,
        itemListElement: g.embedded.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.name })),
      }],
    }));
  }
  const sortedGuides = guides.slice().sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  page('guides.html', shell({
    kind: 'guides', title: `Buying guides${store.seo.titleSuffix}`, description: `Plain-language guides to buying an ex-UK ${noun.one} in Kenya, from ${store.name}.`, canonical: `${origin}/guides`,
    body: `<section class="sf-section"><div class="sf-wrap sf-wrap--narrow"><h1>Buying guides</h1><p class="sf-guide__lede">How to choose, what to check, and which ${esc(noun.many)} are worth it at each budget.</p><div class="sf-teasers sf-teasers--list">${sortedGuides.map((g) => `<article class="sf-teaser"><p class="sf-eyebrow"><time datetime="${esc(g.publishedAt)}">${fmtDate(g.publishedAt)}</time></p><h2><a href="${routes.guide(g.slug)}">${esc(g.title)}</a></h2><p>${esc(g.description || '')}</p></article>`).join('') || '<p>Guides are on the way.</p>'}</div></div></section>`,
  }));

  // ---- 404, sitemap, robots, favicon ----
  page('404.html', shell({
    kind: 'notfound', title: `Page not found${store.seo.titleSuffix}`, description: `This page isn't here. Browse every ${noun.one} in the shop.`, robots: 'noindex',
    body: `<section class="sf-section"><div class="sf-wrap sf-wrap--narrow"><h1>That page isn't here</h1><p>It may have moved. Everything we have is in the shop, and if you can't find what you need, ask us on WhatsApp.</p><p><a class="sf-cta" href="/shop">Browse ${esc(noun.many)}</a> <a class="sf-cta sf-cta--ghost" href="${waHref(store.whatsapp, `Hi ${store.name}, I'm looking for a ${noun.one}: `)}" target="_blank" rel="noopener">Ask on WhatsApp ↗</a></p></div></section>`,
  }));
  const lastmod = (d) => (d ? `<lastmod>${String(d).slice(0, 10)}</lastmod>` : '');
  const urls = [
    { loc: '/' }, { loc: '/shop' },
    ...products.map((p) => ({ loc: routes.product(p.slug), mod: p.createdAt })),
    { loc: '/guides' }, ...guides.map((g) => ({ loc: routes.guide(g.slug), mod: g.updatedAt })),
  ];
  files.push({ path: 'sitemap.xml', content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${origin}${u.loc}</loc>${lastmod(u.mod)}</url>`).join('\n')}\n</urlset>\n` });
  files.push({ path: 'robots.txt', content: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n` });
  files.push({ path: 'favicon.svg', content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="${store.palette.accent}"/><text x="32" y="46" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="700" text-anchor="middle" fill="${store.palette.primary}">${esc(store.name[0])}</text></svg>\n` });

  return { files, warnings, errors, homeSections: sections, homeReport, guides };
}
