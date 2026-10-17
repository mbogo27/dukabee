// Storefront v2 pages, built from the product tree (Site Structure Spec). One composition from a CatalogSource +
// ContentSource to static files:
//   /                          homepage (composeHomepage)
//   /<category>                category listing with filters (e.g. /laptops); filtered views are noindex
//   /<category>/<brand>        brand overview, only when the brand has 2+ stocked series (e.g. /laptops/hp)
//   /<category>/<series>       series page: price range, models table, per-model price sections, advice, FAQ
//   /<category>/<model>        model page: photos, variant (offer) selector, price, WhatsApp; ?variant= → canonical
//   /guides, /guides/<slug>    guide records with model queries and embeds
//   /<page>                    trust pages (about, grade-a, how-it-works); /find-my-laptop quiz
// Flat URLs: hierarchy lives in data and breadcrumbs. Legacy URLs (/p/…, /shop, renamed guides) are listed in
// redirects.json for the server to 301. Returns { files, warnings, errors }; errors fail the build.
import { esc, waHref, imageRef, priceTag, productCard, modelCard, breadcrumbs, nameParts, configLine, cartData, fill, jsonScript } from './ui.mjs';
import { header, footer, cartDrawer, renderHomeSections } from './sections.mjs';
import { composeHomepage } from './compose.mjs';
import { publicProduct, indexEntry, buildFacets, facetCounts, results, emptyQuery, parseRange, inRange, formatKsh, attr1, SORTS, visibleFacetKeys, serializeQuery } from './catalog.mjs';
import { inline, plainText, slugify } from './markdown.mjs';
import { buildTree, priceRangeText } from './tree.mjs';

const EMBEDS = { product: 'slug', products: 'slugs', compare: 'slugs', model: 'slug', models: 'slugs' };
const EMBED_LIMITS = { product: [1, 1], products: [2, 4], compare: [2, 3], model: [1, 1], models: [1, 6] };
const GUIDE_TYPES = { 'use-case': 'Buying guide', trust: 'How we work', comparison: 'Comparison' };
const fmtDate = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00+03:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' });
const fmtShort = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00+03:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });
const ld = (data) => jsonScript(null, data, 'application/ld+json');
const truncate = (s, n) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`; };
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const unitLine = (offer) => (offer.description.split(' This unit: ')[1] || '').trim();

export async function composeStorefront({ catalog, content, relFile = (f) => f, now = new Date() }) {
  const warnings = [], errors = [];
  const store = await catalog.getStore();
  const taxonomy = await catalog.getTaxonomy();
  if (!taxonomy) throw new Error(`${store.name}: storefront v2 needs data/<store>/taxonomy.json (categories, brands, series, tags)`);
  const rawModels = await catalog.listModels();
  const imagesOf = new Map(rawModels.map((m) => [m.modelId, m.images]));
  // Offers are public projections (no cost). Photos are keyed by model, so offers read them from the registry.
  const products = (await catalog.listProducts()).map((p) => ({ ...publicProduct(p), images: imagesOf.get(p.modelId) || p.images }));
  const meta = (await catalog.getCatalogMeta?.()) || {};
  const asOf = meta.generatedAt || null;
  const origin = `https://${store.domain || store.previewDomain}`;
  const abs = (p) => `${origin}${p}`;
  const tree = buildTree({ taxonomy, models: rawModels, products, origin });
  errors.push(...tree.errors);
  const banners = await catalog.listBanners();
  const defs = await catalog.listAttributes();
  const buckets = await catalog.listPriceBuckets();
  const guides = content ? await content.listGuides() : [];
  const trustPages = content?.listPages ? await content.listPages() : [];
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const modelBySlug = new Map([...tree.models.values()].map((m) => [m.slug, m]));
  const cats = [...tree.categories.values()].filter((c) => c.published);
  const primary = tree.categories.get(store.defaultCategory) || cats[0];
  const noun = primary?.nouns || { one: 'product', many: 'products' };
  store.nouns = noun;
  store.browseHref = primary?.path || '/';
  const footnoteMark = '<abbr class="sf-approx" title="Typical for this model">≈</abbr>';
  const asOfHtml = asOf ? ` · as of <time datetime="${esc(asOf)}">${fmtShort(asOf)}</time>` : '';
  const priceLine = (name, r) => (r ? `<p class="sf-priceline"><strong>${esc(name)} price in Kenya:</strong> <span class="sf-mono">${esc(priceRangeText(r))}</span><span class="sf-priceline__meta"> · ${esc(store.condition)}${asOfHtml}</span></p>` : '');
  const crumbsLd = (trail, url) => ({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: trail.filter((c, i) => c.href || i === trail.length - 1).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: c.href ? abs(c.href) : url })),
  });
  const typeLabel = (g) => GUIDE_TYPES[g.type] || 'Guide';
  for (const g of guides) g.typeLabel = typeLabel(g);

  // ---- guides: resolve embeds (unknown slug = error with file:line), model queries, bands, prices in prose ----
  const guidesOfModel = new Map();
  const featureIn = (g, m) => { if (!guidesOfModel.has(m.modelId)) guidesOfModel.set(m.modelId, []); if (!guidesOfModel.get(m.modelId).includes(g)) guidesOfModel.get(m.modelId).push(g); };
  const modelQuery = (attrs) => {
    const tags = list(attrs.tags);
    const band = attrs.band ? parseRange(attrs.band) : null;
    const cat = tree.categories.get(attrs.category || store.defaultCategory);
    return (cat?.models || [])
      .filter((m) => m.available.length && tags.every((t) => m.tagIds.includes(t)) && (!band || m.available.some((o) => inRange(o.price, band))))
      .sort((x, y) => x.priceRange.lo - y.priceRange.lo)
      .slice(0, Number(attrs.limit) || 4);
  };
  for (const g of guides) {
    const file = relFile(g.file);
    g.featured = [];
    const feature = (m) => { if (!g.featured.includes(m)) g.featured.push(m); featureIn(g, m); };
    for (const slug of g.modelsFeatured) { const m = modelBySlug.get(slug); if (m) feature(m); else errors.push(`${file}: modelsFeatured lists unknown model "${slug}"`); }
    for (const b of g.blocks) {
      if ((b.type === 'paragraph' || b.type === 'list') && /KSh\s*\d/.test(b.type === 'list' ? b.items.map((i) => i.text).join(' ') : b.text)) {
        warnings.push(`${file}:${b.line}: price in prose (figures belong on series pages and embeds; frame budgets in headings)`);
      }
      if (b.type !== 'directive') continue;
      if (!EMBEDS[b.name]) { errors.push(`${file}:${b.line}: unknown directive "::${b.name}" (use ::model, ::models, ::product, ::products or ::compare)`); continue; }
      if (b.name === 'models' && !b.attrs.slugs) {
        b.models = modelQuery(b.attrs);
        if (!b.models.length) warnings.push(`${file}:${b.line}: ::models query (${JSON.stringify(b.attrs)}) matches no available model; the block is hidden until stock matches.`);
        b.models.forEach(feature);
        continue;
      }
      const slugs = list(b.attrs[EMBEDS[b.name]]);
      const [min, max] = EMBED_LIMITS[b.name];
      if (slugs.length < min || slugs.length > max) errors.push(`${file}:${b.line}: ::${b.name} takes ${min === max ? min : `${min}–${max}`}, got ${slugs.length}`);
      if (b.name === 'model' || b.name === 'models') {
        b.models = [];
        for (const slug of slugs) { const m = modelBySlug.get(slug); if (!m) errors.push(`${file}:${b.line}: unknown model slug "${slug}" in ::${b.name}`); else { b.models.push(m); feature(m); } }
        continue;
      }
      b.products = [];
      for (const slug of slugs) {
        const p = bySlug.get(slug);
        if (!p) { errors.push(`${file}:${b.line}: unknown product slug "${slug}" in ::${b.name}`); continue; }
        b.products.push(p);
        feature(tree.models.get(p.modelId));
        if (b.attrs.band) {
          const r = parseRange(b.attrs.band);
          if (!r) errors.push(`${file}:${b.line}: band "${b.attrs.band}" should look like 25000-35000 or 45000-`);
          else if (!inRange(p.price, r)) warnings.push(`${file}:${b.line}: ${slug} is now ${formatKsh(p.price)}, outside its band ${b.attrs.band}. Re-pick this embed.`);
        }
        if (p.stock === 'out') warnings.push(`${file}:${b.line}: ${slug} is out of stock; the embed shows "See similar".`);
      }
    }
  }
  const tagsOfGuide = (g) => new Set([...g.tagsTargeted, ...g.featured.flatMap((m) => m.tagIds)]);
  const guidesFor = (m, n = 3) => guides
    .map((g) => ({ g, score: (g.featured.includes(m) ? 3 : 0) + g.tagsTargeted.filter((t) => m.tagIds.includes(t)).length }))
    .filter((x) => x.score > 0).sort((p, q) => q.score - p.score).slice(0, n).map((x) => x.g);
  const relatedGuides = (g, n = 3) => guides.filter((x) => x !== g)
    .map((x) => ({ x, shared: [...tagsOfGuide(x)].filter((t) => tagsOfGuide(g).has(t)).length }))
    .filter((r) => r.shared).sort((p, q) => q.shared - p.shared).slice(0, n).map((r) => r.x);
  const guideLinks = (gs, heading = 'Related guides') => (gs.length ? `<div class="sf-guidelinks"><h2 class="sf-h3">${esc(heading)}</h2><ul>${gs.map((g) => `<li><a href="/guides/${esc(g.slug)}">${esc(g.title)}</a> <small>${esc(g.typeLabel)}</small></li>`).join('')}</ul></div>` : '');

  // ---- shell ----
  const pageSlugs = new Set(trustPages.map((p) => p.slug));
  const nav = [
    ...cats.map((c) => ({ href: c.path, label: c.name, key: `cat:${c.slug}` })),
    { href: '/guides', label: 'Guides', key: 'guides' },
    { href: '/find-my-laptop', label: 'Find my laptop', key: 'quiz' },
    ...(pageSlugs.has('about') ? [{ href: '/about', label: 'About', key: 'page:about' }] : []),
  ];
  const footerColumns = [
    { title: 'Shop', links: [...cats.map((c) => ({ href: c.path, label: `All ${c.nouns.many}` })), ...(primary?.series || []).map((s) => ({ href: s.path, label: s.name }))] },
    { title: 'Guides', links: [...guides.map((g) => ({ href: `/guides/${g.slug}`, label: g.title })), { href: '/guides', label: 'All guides' }] },
    { title: store.name, links: [...trustPages.map((p) => ({ href: `/${p.slug}`, label: p.meta.nav || p.title })), { href: '/find-my-laptop', label: 'Find my laptop' }] },
  ];
  const gallery = (images = [], title) => {
    const shots = images.length ? images : [null];
    const note = shots[0]?.standIn ? `<p class="sf-gallery__note">Photo shows a similar model (${esc(tree.models.get(shots[0].standIn)?.name || 'same family')}). Ask us on WhatsApp for photos and a video of this exact unit.</p>` : '';
    if (shots.length === 1) return imageRef(shots[0], { eager: true, alt: title, cls: 'sf-pdp__img' }) + note;
    return `<div class="sf-gallery" data-gallery><div class="sf-gallery__track" data-gallery-track tabindex="0" role="group" aria-label="${esc(title)} photos">${shots.map((img, i) => `<figure class="sf-gallery__slide">${imageRef(img, { eager: i === 0, alt: `${title}, photo ${i + 1} of ${shots.length}`, cls: 'sf-pdp__img' })}</figure>`).join('')}</div>
<div class="sf-gallery__thumbs">${shots.map((img, i) => `<button type="button" data-gallery-to="${i}" aria-label="Show photo ${i + 1} of ${shots.length}"${i ? '' : ' aria-current="true"'}>${imageRef(img, { alt: '' })}</button>`).join('')}</div></div>${note}`;
  };

  // Brand assets (scripts/dobatron-brand.py): favicon set, and the large icon as the default share image and logo.
  const icons = store.brand?.icons || null;
  const brandImage = icons?.large ? abs(icons.large) : null;

  const shell = ({ kind, current, title, description, canonical, body, top = '', jsonld = [], robots, ogType = 'website', image }) => `<!doctype html>
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
${canonical ? `<meta property="og:url" content="${esc(canonical)}">\n` : ''}${image || brandImage ? `<meta property="og:image" content="${esc(image || brandImage)}">\n` : ''}<meta name="theme-color" content="${esc(store.palette.primary)}">
<meta name="generator" content="Duka Bee · Kiwanda storefront v2">
${(store.seo?.verification || []).map((v) => `<meta name="${esc(v.name)}" content="${esc(v.content)}" />${v.comment ? ` <!-- ${esc(v.comment)} -->` : ''}`).join('\n')}
${icons ? `<link rel="icon" href="${icons.ico}" sizes="any">
<link rel="icon" href="${icons.png32}" type="image/png" sizes="32x32">
<link rel="icon" href="${icons.png48}" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="${icons.apple}">` : '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(store.fonts?.display || 'Space Grotesk').replace(/%20/g, '+')}:wght@400;500;700&family=${encodeURIComponent(store.fonts?.mono || 'JetBrains Mono').replace(/%20/g, '+')}:wght@400;600&display=swap">
<link rel="stylesheet" href="/assets/storefront.css">
<style>:root{--ink:${store.palette.primary};--accent:${store.palette.accent};--paper:${store.palette.paper || '#ffffff'};--font-display:'${store.fonts?.display || 'Space Grotesk'}';--font-mono:'${store.fonts?.mono || 'JetBrains Mono'}'}</style>
${jsonld.map(ld).join('\n')}
</head>
<body class="sf sf-page--${kind}">
<a class="sf-skip" href="#main">Skip to content</a>
${top}${header({ store, current, nav, search: { action: primary?.path || '/', label: noun.many } })}
<main id="main">${body}</main>
${footer({ store, columns: footerColumns })}
${cartDrawer({ store })}
${jsonScript('sf-config', { id: store.id, name: store.name, whatsapp: store.whatsapp, origin, checkout: store.checkout, nouns: noun })}
<script type="module" src="/assets/storefront.js"></script>
</body>
</html>
`;

  const files = [];
  const page = (path, html) => files.push({ path, content: html });
  const sitemap = [];
  const listed = (path, mod) => sitemap.push({ path, mod });
  const ctx = { store, models: tree.models, defs, buckets, origin };

  // ---- home ----
  const listingHref = (q, keys) => {
    const cat = tree.categories.get(q.category) || primary;
    const rest = serializeQuery({ ...q, category: null }, keys);
    return `${cat.path}${rest ? `?${rest}` : ''}`;
  };
  const navSeries = (primary?.series || []).map((s) => ({ id: s.slug, name: s.name, href: s.path, image: s.models.flatMap((m) => m.images || []).find((i) => i.src && !i.standIn) || s.models[0]?.images?.[0] }));
  const homeReport = {};
  const sections = composeHomepage(store, { products, categories: [], series: navSeries, banners, attributes: defs, priceBuckets: buckets, guides, tiers: store.tiers, now, listingHref, seriesHref: (id) => tree.series.get(id)?.path }, homeReport);
  const home = renderHomeSections(sections, ctx);
  page('index.html', shell({
    kind: 'home', current: 'home', title: store.seo.homeTitle, description: store.seo.homeDescription, canonical: `${origin}/`, top: home.top, body: home.main,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Organization', name: store.name, url: `${origin}/`, ...(brandImage ? { logo: brandImage } : {}), telephone: `+${store.whatsapp}`, contactPoint: { '@type': 'ContactPoint', telephone: `+${store.whatsapp}`, contactType: 'sales', areaServed: 'KE' } },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: store.name, url: `${origin}/`, potentialAction: { '@type': 'SearchAction', target: `${origin}${primary.path}?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
    ],
  }));
  listed('/');

  // ---- category pages: listing with filters ----
  for (const c of cats) {
    const offers = c.offers;
    const avail = c.available.length;
    const index = offers.map((p) => indexEntry(p, tree.models.get(p.modelId), defs));
    const facets = buildFacets(index, defs, buckets);
    const q0 = emptyQuery();
    const counts = facetCounts(index, q0, facets, { termsOf: (p) => p.terms });
    const visible = visibleFacetKeys(index, q0, facets);
    const initial = results(index, q0, { termsOf: (p) => p.terms }).map((e) => e.slug);
    const ordered = [...initial.map((s) => bySlug.get(s)), ...offers.filter((p) => !initial.includes(p.slug))];
    const facetHtml = facets.map((f, i) => {
      const def = defs.find((d) => d.key === f.key);
      return `<details class="sf-facet" data-facet="${esc(f.key)}"${i < 6 ? ' open' : ''}${visible.includes(f.key) ? '' : ' hidden'}>
<summary>${esc(f.label)}<span class="sf-facet__n" data-facet-n></span></summary>
${def?.explainer ? `<p class="sf-facet__hint">${esc(def.explainer)}</p>` : ''}<div class="sf-facet__values sf-facet__values--${f.display || 'checkbox'}">${f.values.map((v) => {
        const n = counts[f.key]?.[v.value] || 0;
        return `<label class="sf-opt"><input type="checkbox" name="${esc(f.key)}" value="${esc(v.value)}"${n ? '' : ' disabled'}><span class="sf-opt__label">${esc(v.label)}</span><span class="sf-opt__count" data-count>${n}</span></label>`;
      }).join('')}</div></details>`;
    }).join('\n');
    const trail = tree.crumbs('category', c);
    const body = `<section class="sf-section sf-shop" data-shop><div class="sf-wrap">
${breadcrumbs(trail)}
<div class="sf-shop__head"><div><h1>${esc(c.title || c.name)}</h1><p class="sf-shop__intro">${esc(c.intro || '')}</p></div>
<form class="sf-shop__search" role="search" action="${c.path}" method="get" data-shop-search><label class="sf-sr" for="sf-shop-q">Search ${esc(c.nouns.many)}</label><input id="sf-shop-q" type="search" name="q" placeholder="Model, processor or RAM, e.g. x390 or i7 16gb" autocomplete="off" enterkeyhint="search"></form></div>
${c.series.length > 1 ? `<nav class="sf-catchips" aria-label="Series"><span class="sf-catchips__label">Series:</span>${c.brands.map((b) => `<a href="${b.path}">All ${esc(b.name)}</a>`).join('')}${c.series.map((s) => `<a href="${s.path}">${esc(s.name)} <small>${s.available.length}</small></a>`).join('')}</nav>` : ''}
<div class="sf-shop__bar">
<button type="button" class="sf-cta sf-cta--ghost sf-filters-btn" data-filters-open aria-controls="sf-filters">Filters <span data-filter-n></span></button>
<p class="sf-shop__count" data-result-count aria-live="polite">${avail} ${esc(avail === 1 ? c.nouns.one : c.nouns.many)}</p>
<label class="sf-sort"><span>Sort</span><select data-sort>${SORTS.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></label>
</div>
<div class="sf-active" data-active hidden></div>
<div class="sf-shop__layout">
<aside class="sf-filters" id="sf-filters" data-filters aria-label="Filters">
<div class="sf-filters__head"><h2>Filters</h2><button type="button" class="sf-close" data-filters-close aria-label="Close filters">×</button></div>
<div class="sf-filters__body">${facetHtml}</div>
<div class="sf-filters__foot"><button type="button" class="sf-textlink" data-clear>Clear all</button><button type="button" class="sf-cta" data-filters-close data-filters-apply>Show ${avail} ${esc(c.nouns.many)}</button></div>
</aside>
<div class="sf-shop__results">
<div class="sf-grid" id="sf-results">${ordered.map((p, i) => productCard(p, { model: tree.models.get(p.modelId), eager: i < 4, headingLevel: 2, attrs: p.stock === 'out' ? { hidden: true } : {} })).join('')}</div>
<div class="sf-empty" data-empty hidden><h2>${esc(store.emptyState?.text || 'Nothing matches those filters.')}</h2><p><a class="sf-cta sf-cta--wa" data-sourcing href="${waHref(store.whatsapp)}" target="_blank" rel="noopener">${esc(store.emptyState?.cta || 'Ask us on WhatsApp')} ↗</a> <button type="button" class="sf-cta sf-cta--ghost" data-clear>Clear filters</button></p></div>
<p class="sf-shop__quiz">Not sure which one fits? <a href="/find-my-laptop">Answer 4 questions and get 2 or 3 matches →</a></p>
</div></div></div></section>
${jsonScript('sf-index', { pageCategory: c.slug, facets, defs: defs.map(({ key, label, order, summary, valueSummaries }) => ({ key, label, order, summary, valueSummaries })), buckets, categories: [{ id: c.slug, name: c.name }], products: index, nouns: c.nouns, emptyMessage: store.emptyState?.message })}`;
    page(`${c.slug}.html`, shell({
      kind: 'category', current: `cat:${c.slug}`, title: `${c.title || c.name} in Kenya${store.seo.titleSuffix}`,
      description: `${avail} ${(c.title || c.name).toLowerCase()} from ${[...new Set(c.models.map((m) => m.brand?.name))].filter(Boolean).join(', ')}. Filter by price, RAM, processor, touchscreen and more.`,
      canonical: abs(c.path), body, jsonld: [crumbsLd(trail, abs(c.path))],
    }));
    listed(c.path);
  }

  // ---- brand pages (only brands with 2+ stocked series in the category) ----
  for (const c of cats) for (const b of c.brands) {
    const trail = tree.crumbs('brand', b);
    const body = `<section class="sf-section"><div class="sf-wrap">${breadcrumbs(trail)}
<h1>${esc(b.name)} refurbished ${esc(c.nouns.many)}</h1>
<p class="sf-guide__lede">${esc(b.overview || '')}</p>
<div class="sf-seriescards">${b.series.filter((s) => s.available.length).map((s) => `<a class="sf-seriescard" href="${s.path}"><h2>${esc(s.name)}</h2><p>${esc(s.knownFor || '')}</p><p class="sf-seriescard__meta"><span class="sf-mono">${esc(priceRangeText(s.priceRange))}</span> · ${s.models.length} model${s.models.length === 1 ? '' : 's'}, ${s.available.length} configuration${s.available.length === 1 ? '' : 's'}</p><span class="sf-textlink">See ${esc(s.shortName)} models →</span></a>`).join('')}</div>
</div></section>`;
    page(`${c.slug}/${b.slug}.html`, shell({
      kind: 'brand', current: `cat:${c.slug}`, title: `${b.name} refurbished ${c.nouns.many} in Kenya${store.seo.titleSuffix}`,
      description: truncate(`${b.name} ${c.nouns.many}: ${b.series.map((s) => s.shortName).join(', ')}. ${b.overview || ''}`, 155), canonical: abs(b.path), body, jsonld: [crumbsLd(trail, abs(b.path))],
    }));
    listed(b.path);
  }

  // ---- series pages ----
  const winList = (models) => models.filter((m) => m.offers.some((o) => attr1(o, 'windows11') === 'Yes')).map((m) => m.shortName);
  for (const s of tree.series.values()) {
    if (!s.published) continue;
    const c = s.category;
    const trail = tree.crumbs('series', s);
    const url = abs(s.path);
    const win = c.slug === 'laptops' && s.slug !== 'apple-macbook-pro' ? winList(s.models) : [];
    const faq = [
      ...(s.priceRange ? [{ q: `How much does a ${s.name} cost in Kenya?`, a: `Grade A ${s.name} ${c.nouns.many} on ${store.name} cost ${priceRangeText(s.priceRange)}${asOf ? ` as of ${fmtDate(asOf)}` : ''}, depending on the model and configuration. The table above gives the range for each model.` }] : []),
      ...(win.length ? [{ q: `Which ${s.shortName} models run Windows 11?`, a: `${win.join(', ')}. ${win.length < s.models.length ? 'The others have older processors that Windows 11 does not officially support.' : 'All of them have processors that Windows 11 supports.'}` }] : []),
      ...(s.faq || []),
    ];
    const rows = s.models.map((m) => `<tr><th scope="row"><a href="${m.path}">${esc(m.shortName)}</a></th><td>${esc(m.generation || '—')}</td><td class="sf-mono">${esc(m.typicalSpecs)}</td><td class="sf-mono">${m.available.length ? esc(priceRangeText(m.priceRange)) : 'Ask us'}</td></tr>`).join('');
    const modelSections = s.models.map((m) => `<section class="sf-series__model" id="${esc(m.slug)}">
<h2>${esc(m.name)} price in Kenya</h2>
<p>${m.available.length ? `${m.available.length} configuration${m.available.length === 1 ? '' : 's'} at <span class="sf-mono">${esc(priceRangeText(m.priceRange))}</span> (${esc(store.condition)}${asOf ? `, as of ${fmtShort(asOf)}` : ''}). ` : 'Not available right now; ask us to source one. '}${esc(m.blurb)}</p>
<div class="sf-grid sf-grid--rail">${(m.available.length ? m.available : m.offers).slice(0, 3).map((o) => productCard(o, { model: m, headingLevel: 3 })).join('')}</div>
<p><a class="sf-textlink" href="${m.path}">See every ${esc(m.shortName)} configuration →</a></p>
</section>`).join('\n');
    const gs = [...new Set(s.models.flatMap((m) => guidesFor(m, 5)))].slice(0, 4);
    const body = `<div class="sf-wrap sf-series">${breadcrumbs(trail)}
<header class="sf-series__head"><h1>${esc(s.name)} ${esc(c.nouns.many)}</h1>${priceLine(s.name, s.priceRange)}</header>
<section class="sf-summary" aria-label="${esc(s.name)} summary"><dl>
<div><dt>Price range</dt><dd class="sf-mono">${s.available.length ? esc(priceRangeText(s.priceRange)) : 'Ask us'}</dd></div>
<div><dt>Condition</dt><dd><a href="/grade-a">${esc(store.condition)}</a>, inspected before listing</dd></div>
<div><dt>Models</dt><dd>${s.models.length} model${s.models.length === 1 ? '' : 's'}, ${s.available.length} configuration${s.available.length === 1 ? '' : 's'}</dd></div>
${asOf ? `<div><dt>Prices as of</dt><dd><time datetime="${esc(asOf)}">${fmtDate(asOf)}</time></dd></div>` : ''}
</dl><p class="sf-summary__known"><strong>Known for:</strong> ${esc(s.knownFor || '')}</p></section>
<h2>Models and prices</h2>
<div class="sf-tablewrap" role="region" aria-label="${esc(s.name)} models" tabindex="0"><table class="sf-models"><thead><tr><th scope="col">Model</th><th scope="col">Generation</th><th scope="col">Typical specs</th><th scope="col">Price range</th></tr></thead><tbody>${rows}</tbody></table></div>
${modelSections}
${s.advice?.length ? `<section class="sf-advice"><h2>Which ${esc(s.shortName)} should you buy?</h2><ul>${s.advice.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p>Still not sure? <a href="/find-my-laptop">Find my laptop</a> asks 4 questions and suggests 2 or 3 matches.</p></section>` : ''}
${faq.length ? `<section class="sf-faq"><h2>${esc(s.shortName)} FAQ</h2>${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>` : ''}
${guideLinks(gs)}
<p class="sf-uplink"><a href="${c.path}">All ${esc(c.nouns.many)} →</a></p>
</div>`;
    page(`${c.slug}/${s.slug}.html`, shell({
      kind: 'series', current: `cat:${c.slug}`, title: `${s.name} price in Kenya: ${s.models.length} models${store.seo.titleSuffix}`,
      description: truncate(`${s.name} ${c.nouns.many} in Kenya${s.priceRange ? ` from ${formatKsh(s.priceRange.lo)}` : ''}, Grade A. ${s.knownFor || ''}`, 155), canonical: url, body,
      jsonld: [crumbsLd(trail, url),
        ...(faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
        { '@context': 'https://schema.org', '@type': 'ItemList', name: `${s.name} models`, itemListElement: s.models.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: m.url, name: m.name })) }],
    }));
    listed(s.path);
  }

  // ---- model pages ----
  const specTable = (o) => {
    const rows = defs.filter((d) => o.attributes[d.key]?.length).map((d) => {
      const v = o.attributes[d.key].join(', ');
      const hint = d.valueHints?.[v];
      return `<tr><th scope="row">${esc(d.label)}</th><td>${esc(v)}${o.inferred?.includes(d.key) ? ` ${footnoteMark}` : ''}${hint ? `<span class="sf-spec__hint">${esc(hint)}</span>` : ''}</td></tr>`;
    }).join('');
    const notes = (o.inferred || []).filter((k) => store.inferredNotes?.[k]).map((k) => `<p class="sf-footnote">${footnoteMark} ${esc(store.inferredNotes[k])}</p>`).join('');
    const anyInferred = (o.inferred || []).some((k) => o.attributes[k]);
    return `<table class="sf-spec"><tbody>${rows}</tbody></table>${anyInferred ? `<p class="sf-footnote">${footnoteMark} ${esc(store.inferredFootnote)}</p>` : ''}${notes}`;
  };
  const confidence = (store.confidence || []).length ? `<ul class="sf-confidence" aria-label="Buy with confidence">${store.confidence.map((c) => `<li><strong>${c.href ? `<a href="${esc(c.href)}">${esc(c.title)}</a>` : esc(c.title)}</strong> <span>${esc(c.text)}</span></li>`).join('')}</ul>` : '';
  for (const m of tree.models.values()) {
    const c = m.category;
    const trail = tree.crumbs('model', m);
    const url = m.url;
    const def = m.available[0] || m.offers[0];
    if (!def) { errors.push(`models.json: ${m.modelId} has no offers in products.json`); continue; }
    const related = tree.related(m);
    const similar = related[0];
    const variantLabel = (o) => configLine(nameParts(o, m).config).replace(/ RAM/, '');
    const panels = m.offers.map((o) => {
      const out = o.stock === 'out';
      const offerUrl = abs(o.href);
      return `<div class="sf-variant-panel" data-variant-panel="${esc(o.slug)}"${o === def ? '' : ' hidden'}>
<div class="sf-pdp__price">${priceTag(o.price, { out, size: 'sf-price--lg' })}</div>
<p class="sf-pdp__condition"><span>Condition: <a href="/grade-a">${esc(store.condition)}</a></span> · <span class="${out ? 'sf-stock--out' : 'sf-stock--in'}">${out ? 'Not available right now' : esc(store.availabilityLine || 'Available')}</span></p>
<div class="sf-pdp__ctas">${out
    ? `<a class="sf-cta sf-cta--wa" href="${waHref(store.whatsapp, fill(store.messages.request, { name: o.name, url: offerUrl, price: formatKsh(o.price) }))}" target="_blank" rel="noopener" data-track="request_click">Ask us on WhatsApp ↗</a>`
    : `<button type="button" class="sf-cta" ${Object.entries(cartData(o)).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>Add to cart</button><a class="sf-cta sf-cta--ghost" href="${waHref(store.whatsapp, fill(store.messages.ask, { name: o.name, url: offerUrl }))}" target="_blank" rel="noopener" data-track="ask_click">Ask about this ${esc(c.nouns.one)} ↗</a>`}</div>
<p class="sf-pdp__video"><a href="${waHref(store.whatsapp, fill(store.messages.video || store.messages.ask, { name: o.name, url: offerUrl }))}" target="_blank" rel="noopener" data-track="video_request">Request a video of this machine ↗</a></p>
${unitLine(o) ? `<p class="sf-pdp__unit"><strong>This configuration:</strong> ${esc(unitLine(o))}</p>` : ''}
<h2 class="sf-h3">Specifications</h2>
${specTable(o)}
</div>`;
    }).join('\n');
    const selector = m.offers.length > 1 ? `<fieldset class="sf-variants" data-variants><legend>Choose a configuration <small>(${m.offers.length})</small></legend><div class="sf-variants__list">${m.offers.map((o) => `<label class="sf-variant${o.stock === 'out' ? ' is-out' : ''}"><input type="radio" name="variant" value="${esc(o.slug)}"${o === def ? ' checked' : ''}><span class="sf-variant__cfg">${esc(variantLabel(o))}</span><span class="sf-variant__price">${o.stock === 'out' ? 'Ask us' : esc(formatKsh(o.price))}</span></label>`).join('')}</div></fieldset>`
      : `<p class="sf-pdp__config">${esc(configLine(nameParts(def, m).config))}</p>`;
    const oos = m.available.length ? '' : `<div class="sf-oos"><p><strong>None of these configurations is available right now.</strong> We keep this page so you can still ask: we may be able to source one.</p><p><a class="sf-cta sf-cta--wa" href="${waHref(store.whatsapp, fill(store.messages.model, { name: m.name, url }))}" target="_blank" rel="noopener">Ask us on WhatsApp ↗</a>${similar ? ` <a class="sf-cta sf-cta--ghost" href="${similar.path}">See a similar model: ${esc(similar.name)}</a>` : ''}</p></div>`;
    const body = `<div class="sf-wrap">${breadcrumbs(trail)}
<article class="sf-pdp${m.available.length ? '' : ' is-out'}" data-model-page="${esc(m.slug)}">
<div class="sf-pdp__media">${gallery(m.images, m.name)}</div>
<div class="sf-pdp__info">
<p class="sf-eyebrow"><a href="${m.series.path}">${esc(m.series.name)}</a> · ${esc(m.formFactor)}${m.generation ? ` · ${esc(m.generation)}` : ''}</p>
<h1 class="sf-pdp__title">${esc(m.name)}</h1>
${priceLine(m.name, m.priceRange)}
${oos}
${selector}
${panels}
${confidence}
<div class="sf-pdp__desc"><h2 class="sf-h3">About the ${esc(m.shortName)}</h2><p>${esc(m.blurb)}</p></div>
${guideLinks(guidesFor(m))}
<p class="sf-uplink"><a href="${m.series.path}">All ${esc(m.series.name)} models and prices →</a></p>
</div></article></div>
${related.length ? `<section class="sf-section sf-related"><div class="sf-wrap"><div class="sf-section__head"><h2>Similar ${esc(c.nouns.many)}</h2></div><div class="sf-grid sf-grid--rail">${related.map((r) => modelCard(r)).join('')}</div></div></section>` : ''}`;
    const imgs = (m.images || []).filter((i) => i.src).map((i) => abs(i.src));
    const pr = m.priceRange;
    page(`${c.slug}/${m.slug}.html`, shell({
      kind: 'model', current: `cat:${c.slug}`, title: `${m.name} price in Kenya${store.seo.titleSuffix}`,
      description: truncate(`${m.name}${pr ? `: ${priceRangeText(pr)}` : ''}, ${store.condition}. ${m.blurb}`, 155), canonical: url, body, ogType: 'product', image: imgs[0],
      jsonld: [{
        '@context': 'https://schema.org', '@type': 'Product', name: m.name, url, sku: m.slug, ...(imgs.length ? { image: imgs } : {}),
        brand: { '@type': 'Brand', name: m.brand?.name }, model: m.name, description: m.blurb, category: c.name,
        ...(pr ? { offers: {
          '@type': 'AggregateOffer', priceCurrency: 'KES', lowPrice: String(pr.lo), highPrice: String(pr.hi), offerCount: String(m.available.length || m.offers.length),
          availability: m.available.length ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: `https://schema.org/${store.itemCondition || 'RefurbishedCondition'}`, seller: { '@type': 'Organization', name: store.name },
        } } : {}),
      }, crumbsLd(trail, url)],
    }));
    listed(m.path, def.createdAt);
  }

  // ---- guides ----
  const embedCard = (p, g) => {
    const m = tree.models.get(p.modelId), { title, config } = nameParts(p, m), out = p.stock === 'out';
    const track = (action) => `data-embed-action="${action}" data-guide="${esc(g.slug)}" data-embed-slug="${esc(p.slug)}"`;
    const similar = out ? tree.related(m, 1)[0] : null;
    return `<article class="sf-embed${out ? ' is-out' : ''}">
<a class="sf-embed__media" href="${esc(p.href)}" ${track('view')} tabindex="-1" aria-hidden="true">${imageRef(p.images?.[0], { alt: title })}</a>
<div class="sf-embed__body"><h3 class="sf-embed__title"><a href="${esc(p.href)}" ${track('view')}>${esc(title)}</a></h3>
<p class="sf-mono sf-embed__config">${esc(configLine(config))}</p>
${priceTag(p.price, { out })}
<div class="sf-embed__ctas">${out
    ? `${similar ? `<a class="sf-cta" href="${similar.path}" ${track('view')}>See similar</a>` : ''}<a class="sf-cta sf-cta--ghost" href="${waHref(store.whatsapp, fill(store.messages.request, { name: p.name, url: abs(p.href), price: formatKsh(p.price) }))}" target="_blank" rel="noopener" ${track('whatsapp')}>Ask us ↗</a>`
    : `<button type="button" class="sf-cta" ${Object.entries(cartData(p)).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')} ${track('cart')}>Add to cart</button><a class="sf-cta sf-cta--ghost" href="${waHref(store.whatsapp, fill(store.messages.ask, { name: p.name, url: abs(p.href) }))}" target="_blank" rel="noopener" ${track('whatsapp')}>Ask on WhatsApp ↗</a>`}</div>
</div></article>`;
  };
  const compareTable = (ps, g) => {
    const rows = defs.filter((d) => ps.some((p) => p.attributes[d.key]?.length)).map((d) => {
      const vals = ps.map((p) => (p.attributes[d.key] || []).join(', '));
      return `<tr${new Set(vals).size > 1 ? ' class="is-diff"' : ''}><th scope="row">${esc(d.label)}</th>${ps.map((p, i) => `<td>${esc(vals[i] || '—')}${p.inferred?.includes(d.key) ? ` ${footnoteMark}` : ''}</td>`).join('')}</tr>`;
    }).join('');
    const track = (p, action) => `data-embed-action="${action}" data-guide="${esc(g.slug)}" data-embed-slug="${esc(p.slug)}"`;
    return `<div class="sf-compare" role="region" aria-label="Comparison of ${ps.length} ${esc(noun.many)}" tabindex="0"><table>
<thead><tr><th scope="col"><span class="sf-sr">Spec</span></th>${ps.map((p) => `<th scope="col"><a href="${esc(p.href)}" ${track(p, 'view')}>${esc(nameParts(p, tree.models.get(p.modelId)).title)}</a></th>`).join('')}</tr></thead>
<tbody><tr class="sf-compare__price"><th scope="row">Price</th>${ps.map((p) => `<td>${priceTag(p.price, { out: p.stock === 'out' })}</td>`).join('')}</tr>${rows}
<tr><th scope="row"><span class="sf-sr">Buy</span></th>${ps.map((p) => `<td>${p.stock === 'out' ? '<span class="sf-badge">Not available</span>' : `<button type="button" class="sf-cta sf-cta--sm" ${Object.entries(cartData(p)).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')} ${track(p, 'cart')}>Add to cart</button>`}</td>`).join('')}</tr>
</tbody></table></div><p class="sf-fine">Highlighted rows differ. ${footnoteMark} ${esc(store.inferredFootnote)}</p>`;
  };
  const renderBlocks = (blocks, g) => blocks.map((b) => {
    if (b.type === 'heading') { const lvl = Math.min(Math.max(b.level, 2), 4); return `<h${lvl} id="${slugify(b.text)}">${inline(b.text)}</h${lvl}>`; }
    if (b.type === 'paragraph') return `<p>${inline(b.text)}</p>`;
    if (b.type === 'list') return `<ul>${b.items.map((i) => `<li>${inline(i.text)}</li>`).join('')}</ul>`;
    if (b.type !== 'directive' || !g) return '';
    if (b.models?.length) return `<div class="sf-embeds sf-embeds--models" data-embed-block="${b.name}"><div class="sf-grid sf-grid--rail">${b.models.map((m) => modelCard(m, { attrs: { 'data-embed-action': 'view', 'data-guide': g.slug, 'data-embed-slug': m.slug } })).join('')}</div></div>`;
    if (!b.products?.length) return '';
    if (b.name === 'product') return `<div class="sf-embeds sf-embeds--one" data-embed-block="product">${embedCard(b.products[0], g)}</div>`;
    if (b.name === 'products') return `<div class="sf-embeds sf-embeds--row" data-embed-block="products">${b.products.map((p) => embedCard(p, g)).join('')}</div>`;
    return `<div class="sf-embeds" data-embed-block="compare">${compareTable(b.products, g)}</div>`;
  }).join('\n');
  // FAQ = the H3 questions under an H2 named "FAQ" / "Frequently asked questions".
  const faqOf = (blocks) => {
    const out = [];
    let inFaq = false, cur = null;
    for (const b of blocks) {
      if (b.type === 'heading' && b.level === 2) { inFaq = /^(faq|frequently asked questions)$/i.test(plainText(b.text).trim()); cur = null; continue; }
      if (!inFaq) continue;
      if (b.type === 'heading' && b.level === 3) { cur = { q: plainText(b.text), a: '' }; out.push(cur); } else if (cur && b.type === 'paragraph') cur.a += (cur.a ? ' ' : '') + plainText(b.text);
    }
    return out.filter((f) => f.a);
  };
  for (const g of guides) {
    const path = `/guides/${g.slug}`;
    const url = abs(path);
    const trail = [{ label: 'Home', href: '/' }, { label: 'Guides', href: '/guides' }, { label: g.title, href: null }];
    const faq = faqOf(g.blocks);
    const body = `<article class="sf-guide"><div class="sf-wrap sf-wrap--narrow">${breadcrumbs(trail)}
<header class="sf-guide__head"><p class="sf-eyebrow">${esc(g.typeLabel)}</p><h1>${esc(g.title)}</h1><p class="sf-guide__lede">${esc(g.description || '')}</p><p class="sf-guide__meta">By ${esc(g.author || store.name)} · Updated <time datetime="${esc(g.updatedAt)}">${fmtDate(g.updatedAt)}</time>${g.lastVerified ? ` · Prices and stock checked <time datetime="${esc(g.lastVerified)}">${fmtDate(g.lastVerified)}</time>` : ''}</p></header>
<div class="sf-prose">${renderBlocks(g.blocks, g)}</div>
${guideLinks(relatedGuides(g))}
</div></article>`;
    page(`guides/${g.slug}.html`, shell({
      kind: 'guide', current: 'guides', title: `${g.title}${store.seo.titleSuffix}`, description: g.description || truncate(plainText(g.blocks.find((b) => b.type === 'paragraph')?.text || ''), 155), canonical: url, body, ogType: 'article',
      jsonld: [{
        '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, datePublished: g.publishedAt, dateModified: g.updatedAt,
        author: { '@type': 'Organization', name: g.author || store.name, url: `${origin}/` }, publisher: { '@type': 'Organization', name: store.name, url: `${origin}/` }, mainEntityOfPage: url,
      }, {
        '@context': 'https://schema.org', '@type': 'ItemList', name: g.title,
        itemListElement: g.featured.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: m.url, name: m.name })),
      }, ...(faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
      crumbsLd(trail, url)],
    }));
    listed(path, g.updatedAt);
  }
  const sortedGuides = guides.slice().sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  page('guides.html', shell({
    kind: 'guides', current: 'guides', title: `Buying guides${store.seo.titleSuffix}`, description: `Plain-language guides to choosing a Grade A refurbished ${noun.one} in Kenya, from ${store.name}.`, canonical: abs('/guides'),
    body: `<section class="sf-section"><div class="sf-wrap sf-wrap--narrow">${breadcrumbs([{ label: 'Home', href: '/' }, { label: 'Guides', href: null }])}<h1>Buying guides</h1><p class="sf-guide__lede">Which ${esc(noun.one)} fits your work and budget, and what to check before you pay.</p><div class="sf-teasers sf-teasers--list">${sortedGuides.map((g) => `<article class="sf-teaser"><p class="sf-eyebrow">${esc(g.typeLabel)} · <time datetime="${esc(g.updatedAt)}">${fmtDate(g.updatedAt)}</time></p><h2><a href="/guides/${esc(g.slug)}">${esc(g.title)}</a></h2><p>${esc(g.description || '')}</p></article>`).join('') || '<p>Guides are on the way.</p>'}</div></div></section>`,
  }));
  listed('/guides');

  // ---- trust pages ----
  for (const p of trustPages) {
    const trail = [{ label: 'Home', href: '/' }, { label: p.meta.nav || p.title, href: null }];
    const url = abs(`/${p.slug}`);
    page(`${p.slug}.html`, shell({
      kind: 'page', current: `page:${p.slug}`, title: `${p.title}${store.seo.titleSuffix}`, description: p.description || truncate(plainText(p.blocks.find((b) => b.type === 'paragraph')?.text || ''), 155), canonical: url,
      body: `<article class="sf-guide sf-trust-page"><div class="sf-wrap sf-wrap--narrow">${breadcrumbs(trail)}<header class="sf-guide__head"><h1>${esc(p.title)}</h1>${p.description ? `<p class="sf-guide__lede">${esc(p.description)}</p>` : ''}${p.updatedAt ? `<p class="sf-guide__meta">Updated <time datetime="${esc(p.updatedAt)}">${fmtDate(p.updatedAt)}</time></p>` : ''}</header><div class="sf-prose">${renderBlocks(p.blocks, null)}</div></div></article>`,
      jsonld: [crumbsLd(trail, url)],
    }));
    listed(`/${p.slug}`, p.updatedAt);
  }

  // ---- find-my-laptop quiz (a tool, not an SEO page: noindex, linked from series pages and guides) ----
  if (primary) {
    const useTags = (taxonomy.tags || []).filter((t) => t.type === 'use_case');
    const quizData = {
      models: primary.models.filter((m) => m.offers.length).map((m) => ({
        slug: m.slug, name: m.name, href: m.path, url: m.url, image: (m.images || []).find((i) => i.src)?.src || null, use: m.tags?.use_case || [], feature: m.tags?.feature || [],
        screen: m.screenInches, offers: m.offers.map((o) => ({ slug: o.slug, href: o.href, price: o.price, available: o.stock !== 'out', ram: parseInt(attr1(o, 'ram'), 10) || 0, touch: attr1(o, 'touch') === 'Yes', cpu: attr1(o, 'cpu') || '', label: configLine(nameParts(o, m).config), dedicated: attr1(o, 'graphics') === 'Dedicated' })),
      })),
      guides: guides.filter((g) => g.type === 'use-case').map((g) => ({ title: g.title, href: `/guides/${g.slug}`, tags: g.tagsTargeted })),
      useLabels: Object.fromEntries(useTags.map((t) => [t.id, t.label])),
    };
    const q = (name, legend, options) => `<fieldset class="sf-quiz__q"><legend>${esc(legend)}</legend><div class="sf-quiz__opts">${options.map(([v, label], i) => `<label class="sf-choice"><input type="radio" name="${name}" value="${esc(v)}" required${i === 0 ? '' : ''}><span>${esc(label)}</span></label>`).join('')}</div></fieldset>`;
    page('find-my-laptop.html', shell({
      kind: 'quiz', current: 'quiz', title: `Find my laptop${store.seo.titleSuffix}`, description: `Answer 4 quick questions and ${store.name} suggests 2 or 3 Grade A ${noun.many} that fit how you'll use it and your budget.`, robots: 'noindex, follow', canonical: abs('/find-my-laptop'),
      body: `<section class="sf-section sf-quiz" data-quiz><div class="sf-wrap sf-wrap--narrow">${breadcrumbs([{ label: 'Home', href: '/' }, { label: 'Find my laptop', href: null }])}
<h1>Find my laptop</h1><p class="sf-guide__lede">Four quick questions, no tech terms. We'll suggest two or three ${esc(noun.many)} and you can ask us about any of them on WhatsApp.</p>
<form class="sf-quiz__form" data-quiz-form novalidate>
${q('use', 'What will you use it for?', useTags.map((t) => [t.id, { student: 'School and studying', business: 'Office work and business', coding: 'Programming', design: 'Design, photos and video' }[t.id] || t.label]))}
${q('budget', 'What is your budget?', [['0-30000', 'Under KSh 30,000'], ['30000-45000', 'KSh 30,000 to 45,000'], ['45000-', 'Over KSh 45,000'], ['any', 'Not sure yet']])}
${q('style', 'Light and portable, or more power?', [['portable', 'Light and portable'], ['power', 'More power'], ['either', 'No preference']])}
${q('touch', 'Do you want a touchscreen?', [['yes', 'Yes'], ['no', 'No'], ['either', "Don't mind"]])}
<button type="submit" class="sf-cta">Show my matches</button>
</form>
<div class="sf-quiz__results" data-quiz-results hidden aria-live="polite"></div>
</div></section>
${jsonScript('sf-quiz', quizData)}`,
    }));
  }

  // ---- 404, redirects, sitemap, robots, favicon ----
  page('404.html', shell({
    kind: 'notfound', current: '', title: `Page not found${store.seo.titleSuffix}`, description: `This page isn't here. Browse every ${noun.one} we can source.`, robots: 'noindex',
    body: `<section class="sf-section"><div class="sf-wrap sf-wrap--narrow"><h1>That page isn't here</h1><p>It may have moved. Everything we can source is listed below, and if you can't find what you need, ask us on WhatsApp.</p><p>${cats.map((c) => `<a class="sf-cta" href="${c.path}">Browse ${esc(c.nouns.many)}</a>`).join(' ')} <a class="sf-cta sf-cta--ghost" href="${waHref(store.whatsapp, `Hi ${store.name}, I'm looking for a ${noun.one}: `)}" target="_blank" rel="noopener">Ask on WhatsApp ↗</a></p></div></section>`,
  }));
  // Legacy and renamed URLs → permanent 301s, kept indefinitely (served by worker/index.mjs and scripts/preview.mjs).
  const redirects = { '/shop': primary?.path || '/' };
  for (const p of products) redirects[`/p/${p.slug}`] = p.href;
  for (const g of guides) for (const old of g.redirectFrom) redirects[`/guides/${old}`] = `/guides/${g.slug}`;
  files.push({ path: 'redirects.json', content: `${JSON.stringify(redirects, null, 1)}\n` });
  const lastmod = (d) => (d ? `<lastmod>${String(d).slice(0, 10)}</lastmod>` : '');
  files.push({ path: 'sitemap.xml', content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((u) => `<url><loc>${abs(u.path)}</loc>${lastmod(u.mod)}</url>`).join('\n')}\n</urlset>\n` });
  files.push({ path: 'robots.txt', content: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n` });
  if (!icons) files.push({ path: 'favicon.svg', content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="${store.palette.accent}"/><text x="32" y="46" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="700" text-anchor="middle" fill="${store.palette.primary}">${esc(store.name[0])}</text></svg>\n` });

  return { files, warnings, errors, homeSections: sections, homeReport, guides, tree, redirects };
}
