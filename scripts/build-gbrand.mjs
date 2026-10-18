// Build the GBRAND store (data/gbrand/ + stores/gbrand/ runtime) into dist/stores/gbrand/, served at gbrand.dukabee.co.ke.
//
//   node scripts/build-gbrand.mjs               # → dist/stores/gbrand
//   node scripts/build-gbrand.mjs --out tmp     # elsewhere (tests)
//
// Content comes only from data/gbrand/{store,products,clubs,pages}.json and data/gbrand/content/magazine/*.md,
// so a new product or post appears everywhere with no code change. Dependency-free, like the rest of this repo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../kiwanda/v2/markdown.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data', 'gbrand');
const RUNTIME = path.join(ROOT, 'stores', 'gbrand');

/** The live store's origin. The client preview lives under https://dukabee.co.ke/preview/<id> (data/gbrand/preview.json). */
export const SITE = 'https://gbrand.dukabee.co.ke';
export const PREVIEW_ORIGIN = 'https://dukabee.co.ke';

export class BuildError extends Error {}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ksh = (n) => `KSh ${Number(n).toLocaleString('en-KE')}`;
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

/* ---------------- Markdown (posts) ---------------- */
const inlineMd = (s) => esc(s)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

/** Headings, paragraphs, bullet and numbered lists, blockquotes and tables: everything the magazine uses. */
export function renderMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{2,3})\s+(.*)$/))) { out.push(m[1].length === 2 ? `<h2 id="${slugify(m[2])}">${inlineMd(m[2])}</h2>` : `<h3>${inlineMd(m[2])}</h3>`); i++; continue; }
    if (/^>\s?/.test(l)) {
      const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inlineMd(q.join(' '))}</blockquote>`); continue;
    }
    if (/^\|/.test(l) && /^\|?\s*:?-+/.test(lines[i + 1] || '')) {
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${inlineMd(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^[-*]\s+/.test(l)) { const it = []; while (i < lines.length && /^[-*]\s+/.test(lines[i])) it.push(lines[i++].replace(/^[-*]\s+/, '')); out.push(`<ul>${it.map((x) => `<li>${inlineMd(x)}</li>`).join('')}</ul>`); continue; }
    if (/^\d+\.\s+/.test(l)) { const it = []; while (i < lines.length && /^\d+\.\s+/.test(lines[i])) it.push(lines[i++].replace(/^\d+\.\s+/, '')); out.push(`<ol>${it.map((x) => `<li>${inlineMd(x)}</li>`).join('')}</ol>`); continue; }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>|\||[-*]\s|\d+\.\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inlineMd(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

const slugify = (t) => t.toLowerCase().replace(/\*\*?/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const parseList = (s) => String(s || '').replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean);

/* ---------------- data ---------------- */
function loadData() {
  const store = readJson('store.json'), pages = readJson('pages.json');
  const clubList = readJson('clubs.json');
  const clubs = Object.fromEntries(clubList.map((c) => [c.slug, c]));
  const products = readJson('products.json').filter((p) => p.inStock !== false).map((p) => ({ ...p, no: p.sku.replace(/^[A-Za-z]+-/, '') }));
  const errors = [];
  const slugs = new Set();
  for (const p of products) {
    if (slugs.has(p.slug)) errors.push(`duplicate product slug ${p.slug}`); slugs.add(p.slug);
    if (!clubs[p.club]) errors.push(`${p.slug}: unknown club "${p.club}"`);
    for (const img of Object.values(p.images || {})) if (!fs.existsSync(path.join(DATA, img))) errors.push(`${p.slug}: missing image ${img}`);
  }
  for (const c of clubList) if (!fs.existsSync(path.join(DATA, c.crest))) errors.push(`club ${c.slug}: missing crest ${c.crest}`);
  const dir = path.join(DATA, 'content', 'magazine');
  const posts = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const post = {
      slug: data.slug || f.replace(/\.md$/, ''), title: data.title, category: data.category, date: data.date, readingMinutes: Number(data.readingMinutes) || 3,
      excerpt: data.excerpt, cover: data.cover, related: parseList(data.relatedProducts), author: data.author || 'GBRAND team', body,
    };
    for (const k of ['title', 'category', 'date', 'excerpt', 'cover']) if (!post[k]) errors.push(`${f}: missing "${k}" in frontmatter`);
    if (post.cover && !fs.existsSync(path.join(DATA, post.cover))) errors.push(`${f}: missing cover ${post.cover}`);
    for (const s of post.related) if (!slugs.has(s)) errors.push(`${f}: relatedProducts has unknown product "${s}"`);
    for (const m of body.matchAll(/\]\(\/product\/([a-z0-9-]+)\)/g)) if (!slugs.has(m[1])) errors.push(`${f}: link to unknown product /product/${m[1]}`);
    return post;
  }).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const postSlugs = new Set(posts.map((p) => p.slug));
  for (const p of posts) for (const m of p.body.matchAll(/\]\(\/magazine\/([a-z0-9-]+)\)/g)) if (!postSlugs.has(m[1])) errors.push(`${p.slug}: link to unknown post /magazine/${m[1]}`);
  if (errors.length) throw new BuildError(`gbrand: ${errors.length} data error(s)\n${errors.map((e) => `  ✗ ${e}`).join('\n')}`);
  return { store, pages, clubs, clubList, products, posts };
}

const pngSize = (file) => { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

/* ---------------- builder ---------------- */
export async function buildGbrand({ outDir, preview = true, log = console.log } = {}) {
  const D = loadData();
  const PREVIEW = preview;
  const previewCfg = readJson('preview.json');
  // Every root-relative URL in the preview build is prefixed with its base path, so it works under /preview/<id>/.
  const base = PREVIEW ? `/preview/${previewCfg.id}` : '';
  const site = PREVIEW ? PREVIEW_ORIGIN + base : SITE;
  outDir ||= path.join(ROOT, 'dist', 'stores', PREVIEW ? 'gbrand-preview' : 'gbrand');
  const pre = (u) => (u && u.startsWith('/') ? base + u : u);
  const { store, pages, clubs, clubList, products, posts } = D;
  const offers = store.offers, contact = store.contact;
  const home = store.homepage;
  const block = (name) => home.find((b) => b.block === name)?.props || {};
  const files = new Map(); // path -> string | Buffer
  const put = (p, c) => files.set(p, c);

  // runtime files, fingerprinted so a redeploy is never served stale
  const rt = (f) => fs.readFileSync(path.join(RUNTIME, f), 'utf8');
  const ver = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);

  const counts = {}; products.forEach((p) => { counts[p.club] = (counts[p.club] || 0) + 1; });
  const stockedClubs = clubList.filter((c) => counts[c.slug]).sort((a, b) => counts[b.slug] - counts[a.slug]);
  const byNewest = [...products].sort((a, b) => b.sortNewest - a.sortNewest);
  const kitTypes = store.catalog.kitTypes.filter((t) => products.some((p) => p.kitType === t));
  const sizes = store.catalog.sizes;
  const waGeneral = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(pages.whatsappGeneral)}`;
  const phoneRaw = contact.phoneDisplay.replace(/\s/g, '');

  const catalogJs = `window.GB=${JSON.stringify({
    base, preview: PREVIEW,
    store: { wa: contact.whatsapp },
    offers,
    sizes,
    kitTypes,
    checkout: store.checkout,
    clubs: Object.fromEntries(clubList.map((c) => [c.slug, { name: c.name, crest: pre(c.crest) }])),
    products: Object.fromEntries(products.map((p) => [p.slug, { slug: p.slug, sku: p.sku, no: p.no, name: p.name, price: p.price, category: p.category, club: p.club, thumb: pre(p.images.thumb) }])),
  })};\n`;
  const assetVer = { css: ver(rt('gbrand.css')), js: ver(rt('gbrand.js') + rt('cart-logic.js')), cat: ver(catalogJs) };

  /* ----- small components ----- */
  const crest = (club, cls = 'cr') => `<img class="${cls}" src="${clubs[club].crest}" alt="" loading="lazy">`;
  const priceHtml = (p) => `<div class="price">${p.compareAtPrice && p.compareAtPrice > p.price ? `<span class="now">${ksh(p.price)}</span><s>${ksh(p.compareAtPrice)}</s>` : ksh(p.price)}</div>`;
  const badgeHtml = (p) => (p.compareAtPrice && p.compareAtPrice > p.price ? `<span class="badge">-${Math.round((1 - p.price / p.compareAtPrice) * 100)}%</span>` : p.badge === 'new' ? '<span class="badge badge--new">New</span>' : '');
  const clubVars = (slug) => `--c1:${clubs[slug].colors[0]};--c2:${clubs[slug].colors[1]}`;
  const cardHtml = (p, i, { lazy = true } = {}) => `<article class="card" data-club="${p.club}" data-type="${esc(p.kitType)}" data-club-name="${esc(p.clubName)}" data-i="${i}" data-new="${p.sortNewest}" data-search="${esc([p.name, p.clubName, p.kitType, p.description].join(' ').toLowerCase())}">
  <div class="card__media"><a href="/product/${p.slug}" class="card__img"><img src="${p.images.card}" alt="${esc(p.name)}" width="800" height="1000"${lazy ? ' loading="lazy"' : ''}></a><span class="kno">No.${p.no}</span>${badgeHtml(p)}<button class="quick" data-quick="${p.slug}" aria-label="Quick add ${esc(p.name)}">Quick add</button></div>
  <div class="card__meta"><span class="club">${crest(p.club)}${esc(p.clubName)} · ${esc(p.kitType)}</span><a href="/product/${p.slug}" class="card__name">${esc(p.name)}</a>${priceHtml(p)}</div></article>`;
  const mcardHtml = (po) => `<a href="/magazine/${po.slug}" class="mcard" data-cat="${esc(po.category)}" data-slug="${po.slug}"><div class="mcard__img"><img src="${po.cover}" alt="" width="800" height="1000" loading="lazy"></div><div class="mmeta"><b>${esc(po.category)}</b><span>${fmtDate(po.date)}</span><span>${po.readingMinutes} min read</span></div><h3>${esc(po.title)}</h3><p>${esc(po.excerpt)}</p></a>`;
  const SVG = {
    burger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h12"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    wa: '<svg class="f" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.7.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>',
    shirt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0z"/></svg>',
    mag: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
  };
  const TRUST = {
    truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7', phone: 'M7 3h10v18H7zM10 17h4',
    swap: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4', whatsapp: 'M4 20l1.3-4A8 8 0 1 1 8 18.7z',
  };
  const logoDim = pngSize(path.join(DATA, store.brand.logo));
  const logoImg = (kind, extra = '') => {
    const src = kind === 'dark' ? store.brand.logo : store.brand.logoOnDark, d = pngSize(path.join(DATA, src));
    return `<img src="${src}" width="${d.w}" height="${d.h}" alt="GBRAND, wear your legacy"${extra}>`;
  };

  /* ----- page shell ----- */
  const titleOf = (t) => (t ? store.seo.titleTemplate.replace('%s', t) : store.seo.homeTitle);
  function shell({ path: urlPath, title, description, nav, mnav, body, image, jsonLd = [], ogType = 'website', preload = '', bodyClass = '' }) {
    const url = site + (urlPath === '/' ? '' : urlPath);
    const img = (PREVIEW ? PREVIEW_ORIGIN + base : SITE) + (image || store.seo.ogImage);
    const ticker = store.announcements.map((t) => `<span>${esc(t)}</span>`).join('');
    const isNav = (k) => (nav === k ? ' class="on" aria-current="page"' : '');
    const nv = (label) => store.nav.find((n) => n.label === label)?.href;
    const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${PREVIEW ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="canonical" href="${url}">
<meta name="theme-color" content="${store.theme.colors.ink}">
<meta property="og:site_name" content="${esc(store.store.name)}"><meta property="og:type" content="${ogType}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${img}">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/brand/favicon-192.png"><link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&family=Archivo:wdth,wght@62..125,400..800&display=swap" rel="stylesheet">
${preload}<link rel="stylesheet" href="/gbrand.css?v=${assetVer.css}">
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
${PREVIEW ? '<div class="ribbon" role="note">Preview of your Duka Bee store · Ordering is off</div>\n' : ''}<div class="ticker" aria-label="Store announcements"><div class="ticker__track">${ticker}${ticker.replace(/<span>/g, '<span aria-hidden="true">')}</div></div>
<header class="hdr">
  <div class="wrap hdr__row">
    <button class="ico burger" id="openMenu" aria-label="Open menu">${SVG.burger}</button>
    <a href="/" class="logo" aria-label="GBRAND home">${logoImg('dark')}</a>
    <nav class="nav" aria-label="Main">
      <a href="${nv('Shop')}"${isNav('shop')}>Shop</a>
      <a href="${nv('Our story')}"${isNav('brand')}>Our story</a>
      <a href="${nv('Magazine')}"${isNav('magazine')}>Magazine</a>
    </nav>
    <div class="icons">
      <a class="ico hide-sm" id="hdrSearch" href="/shop#q" aria-label="Search">${SVG.search}</a>
      <a class="ico hide-sm" href="${waGeneral}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${SVG.wa}</a>
      <button class="ico" data-open-cart aria-label="Open bag">${SVG.bag}<span class="n" data-cart-count>0</span></button>
    </div>
  </div>
  <div class="flag"></div>
</header>
<main id="main">
${body}
</main>
${footerHtml()}
<nav class="mbar" aria-label="Quick">
  <a href="/"${mnav === 'home' ? ' class="on" aria-current="page"' : ''}><span class="ico">${SVG.home}</span>Home</a>
  <a href="/shop"${mnav === 'shop' ? ' class="on" aria-current="page"' : ''}><span class="ico">${SVG.shirt}</span>Shop</a>
  <a href="/magazine"${mnav === 'magazine' ? ' class="on" aria-current="page"' : ''}><span class="ico">${SVG.mag}</span>Magazine</a>
  <button data-open-cart aria-label="Open bag"><span class="ico">${SVG.bag}<span class="n" data-cart-count>0</span></span>Bag</button>
</nav>
<div class="scrim" id="scrim"></div>
<aside class="drawer drawer--left" id="menu" aria-label="Menu">
  <div class="dr-head"><h3>Menu</h3><button class="ico" data-close aria-label="Close menu">${SVG.close}</button></div>
  <div class="dr-body"><nav class="mnav" aria-label="Menu"><a href="/">Home</a><a href="/shop">Shop all kits</a><a href="/brand">Our story</a><a href="/magazine">Magazine</a></nav><div class="chips" style="flex-wrap:wrap">${stockedClubs.map((c) => `<a class="chip" style="${clubVars(c.slug)}" href="/shop?club=${c.slug}">${crest(c.slug)}${esc(c.name)}</a>`).join('')}</div></div>
  <div class="dr-foot"><a class="btn btn--green" href="${waGeneral}" target="_blank" rel="noopener">WhatsApp ${esc(contact.phoneDisplay)}</a></div>
</aside>
<aside class="drawer" id="cart" aria-label="Bag">
  <div class="dr-head"><h3 id="cartTitle">Your bag</h3><button class="ico" data-close aria-label="Close bag">${SVG.close}</button></div>
  <div class="dr-body" id="cartBody"></div>
  <div class="dr-foot" id="cartFoot"></div>
</aside>
<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="Choose a size"></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/catalog.js?v=${assetVer.cat}"></script>
<script type="module" src="/gbrand.js?v=${assetVer.js}"></script>
</body>
</html>
`;
    return base ? doc.replace(/(href|src)="\/(?!\/)/g, `$1="${base}/`) : doc;
  }

  function footerHtml() {
    const typeLabel = { Home: 'Home kits', Away: 'Away kits', Third: 'Third kits', Retro: 'Retro', Special: 'Special editions' };
    const guide = (slug, label) => (posts.some((p) => p.slug === slug) ? `<li><a href="/magazine/${slug}">${label}</a></li>` : '');
    return `<section class="join" aria-label="Join the list">
  <div class="wrap">
    <div><h2>${esc(block('join.whatsapp').title)}</h2><p>${esc(block('join.whatsapp').body)}</p></div>
    <div class="joinbox"><a class="btn btn--white" id="joinWa" href="https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(block('join.whatsapp').message)}" target="_blank" rel="noopener">${esc(block('join.whatsapp').button)}</a><small>${esc(block('join.whatsapp').note)}</small>${contact.whatsappChannel ? `<a class="ulink" style="color:#fff" href="${esc(contact.whatsappChannel)}" target="_blank" rel="noopener">Or follow our WhatsApp Channel</a>` : ''}</div>
  </div>
</section>
<footer class="foot">
  <div class="wrap">
    <div class="foot__cols">
      <div>${logoImg('light', ' loading="lazy"')}<p style="margin:14px 0 0;max-width:32ch;font-size:14px">${esc(pages.footer.blurb)}</p></div>
      <div><h4>Shop</h4><ul><li><a href="/shop">All kits</a></li>${kitTypes.filter((t) => ['Retro', 'Special', 'Home'].includes(t)).map((t) => `<li><a href="/shop?type=${t}">${typeLabel[t] || t}</a></li>`).join('')}</ul></div>
      <div><h4>GBRAND</h4><ul><li><a href="/brand">Our story</a></li><li><a href="/magazine">Magazine</a></li>${guide('size-guide', 'Size guide')}${guide('jersey-care', 'Jersey care')}</ul></div>
      <div><h4>Contact</h4><ul><li><a href="tel:+${contact.whatsapp}">${esc(contact.phoneDisplay)}</a></li><li><a href="${waGeneral}" target="_blank" rel="noopener">WhatsApp us</a></li><li>${esc(contact.hours)}</li></ul></div>
    </div>
    <div class="foot__base"><span>© 2026 GBRAND · Built with Duka Bee</span><div class="pay">${pages.footer.payments.map((x) => `<span>${esc(x)}</span>`).join('')}</div></div>
    ${PREVIEW ? `<p class="proto">${esc(pages.footer.previewNote)}</p>` : ''}
  </div>
  <div class="flag" style="margin-top:22px"></div>
</footer>`;
  }

  /* ----- home ----- */
  function homePage() {
    const hero = block('hero.kitWall'), tiles = block('categories.clubTiles'), grid = block('products.grid'), promo = block('promo.pairBundle');
    const spotP = block('product.spotlight'), teaser = block('brand.teaser'), mag = block('magazine.latest'), trust = block('trust.strip');
    const featured = products.find((p) => p.slug === spotP.product) || products.find((p) => p.featured) || products[0];
    // "Just dropped" stack (split layout): the newest kit in front, the next two behind; never the spotlight product.
    const stk = hero.stack || {};
    const nw = byNewest.filter((p) => !(stk.exclude === 'spotlight' && p.slug === featured.slug));
    const stackHtml = hero.layout !== 'center' && nw.length >= 3
      ? `\n  <a class="hero__stack" href="/product/${nw[0].slug}" aria-label="${esc(stk.tag || 'Just dropped')}: ${esc(nw[0].name)}"><div class="hstk hstk--a"><img src="${nw[1].images.thumb}" alt="" width="400" height="500" loading="lazy"></div><div class="hstk hstk--b"><img src="${nw[2].images.thumb}" alt="" width="400" height="500" loading="lazy"></div><div class="hstk hstk--front"><img src="${nw[0].images.card}" alt="" width="800" height="1000" loading="lazy"><span class="hstk__tag">${esc(stk.tag || 'Just dropped')}</span><div class="hstk__bar"><b>${esc(nw[0].name)}</b><span>${ksh(nw[0].price)}</span></div></div></a>` : '';
    // Kit wall: three rows dealt round-robin, each cycled to 12 cards so the -50% marquee shift never shows a gap.
    const rows = [[], [], []]; byNewest.forEach((p, i) => rows[i % 3].push(p));
    const wallRow = (list, rev, row) => {
      const half = Array.from({ length: Math.max(12, list.length) }, (_, i) => list[i % list.length]);
      const cards = [...half, ...half].map((p, i) => `<div class="wcard"><img src="${p.images.thumb}" alt="" width="400" height="500"${row === 0 && i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}><span>No.${p.no}</span></div>`).join('');
      return `<div class="row${rev ? ' rev' : ''}">${cards}</div>`;
    };
    const lcp = byNewest[0] && rows[0][0];
    const stat = (s) => (s === 'kitCount' ? { value: products.length, label: 'Kits in stock' } : s === 'clubCount' ? { value: stockedClubs.length, label: 'Clubs' } : s);
    const hl = hero.headline.map((w) => (w === hero.outlineWord ? `<span class="out">${esc(w)}</span>` : esc(w))).join('<br>');
    const cta2 = hero.secondaryCta.action === 'whatsapp.general' ? waGeneral : hero.secondaryCta.href;
    const pairImgs = (promo.images || []).map((s) => products.find((p) => p.slug === s)).filter(Boolean);
    const pairTitle = promo.title.map(esc).join('<br>');
    const latest = posts.slice(0, mag.limit || 3);
    const html = `<section class="hero${hero.layout === 'center' ? ' hero--center' : ''}">
  <div class="wrap hero__in"><div class="hero__copy">
    <span class="eyebrow" style="color:#ff6b74">${esc(hero.eyebrow)}</span>
    <h1>${hl}</h1>
    <p>${esc(hero.body)}</p>
    <div class="hero__cta"><a href="${hero.primaryCta.href}" class="btn btn--red">${esc(hero.primaryCta.label)}</a><a class="btn btn--ghost" href="${cta2}"${cta2.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(hero.secondaryCta.label)}</a></div>
    <div class="hero__meta">${hero.stats.map(stat).map((s) => `<div><b>${s.value}</b><span>${esc(s.label)}</span></div>`).join('')}</div>
  </div>${stackHtml}</div>
  <div class="wall" aria-hidden="true">${wallRow(rows[0], false, 0)}${wallRow(rows[1].length ? rows[1] : rows[0], true, 1)}${wallRow(rows[2].length ? rows[2] : rows[0], false, 2)}</div>
</section>

<section class="sec wrap">
  <div class="sec-head"><div><span class="eyebrow">${esc(tiles.eyebrow)}</span><h2>${esc(tiles.title)}</h2></div><a href="/shop" class="ulink">All kits</a></div>
  <div class="clubs">${stockedClubs.map((c) => `<a class="clubt" style="${clubVars(c.slug)}" href="/shop?club=${c.slug}"><img src="${c.crest}" alt="" width="58" height="58" loading="lazy"><b>${esc(c.name)}</b><span>${counts[c.slug]} kit${counts[c.slug] === 1 ? '' : 's'}</span></a>`).join('')}</div>
</section>

<section class="sec wrap">
  <div class="sec-head"><div><span class="eyebrow">${esc(grid.eyebrow)}</span><h2>${esc(grid.title)}</h2></div><a href="/shop" class="ulink">Shop all</a></div>
  <div class="grid">${byNewest.slice(0, grid.limit || 8).map((p, i) => cardHtml(p, i)).join('')}</div>
</section>

${promo.title ? `<section class="band">
  <div class="wrap">
    <div><span class="eyebrow" style="color:#fff">${esc(promo.eyebrow)}</span><h2>${pairTitle}</h2><p>${esc(promo.body)}</p><a href="${promo.cta.href}" class="btn btn--light">${esc(promo.cta.label)}</a></div>
    <div class="pair" aria-hidden="true">${pairImgs.length === 2 ? `<div><img src="${pairImgs[0].images.thumb}" alt="" width="400" height="500" loading="lazy"></div><i>+</i><div><img src="${pairImgs[1].images.thumb}" alt="" width="400" height="500" loading="lazy"></div>` : ''}</div>
  </div>
</section>` : ''}

<section class="sec wrap">
  <div class="spot" id="spot" data-slug="${featured.slug}">
    <a href="/product/${featured.slug}" class="spot__img"><img src="${featured.images.card}" alt="${esc(featured.name)}" width="800" height="1000" loading="lazy"><span class="spot__tag">${esc(spotP.tag)}</span></a>
    <div class="spot__copy"><span class="eyebrow pcl"><img class="cr" src="${clubs[featured.club].crest}" alt="">${esc(featured.clubName)} · ${esc(featured.kitType)} · No.${featured.no}</span><h2>${esc(featured.name)}</h2><p>${esc(featured.description)}</p>${priceHtml(featured)}
      <div role="group" aria-labelledby="spLbl"><div class="lbl" id="spLbl">Size</div><div class="sizes">${sizes.map((s) => `<button type="button" class="sz" data-spot-size="${s}" aria-pressed="false">${s}</button>`).join('')}</div></div>
      <p class="err" id="spotErr" role="alert"></p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn--red" id="spotAdd">Add to bag</button><a href="/product/${featured.slug}" class="btn btn--line">Full details</a></div></div>
  </div>
</section>

<section class="sec wrap">
  <div class="bteaser">${logoImg('dark', ' loading="lazy"')}
    <div><span class="eyebrow">${esc(teaser.eyebrow)}</span><p style="margin-top:12px">${esc(teaser.body)}</p><a href="${teaser.cta.href}" class="btn btn--line">${esc(teaser.cta.label)}</a></div>
  </div>
</section>

${latest.length ? `<section class="sec wrap">
  <div class="sec-head"><div><span class="eyebrow">${esc(mag.eyebrow)}</span><h2>${esc(mag.title)}</h2></div><a href="/magazine" class="ulink">All stories</a></div>
  <div class="mgrid">${latest.map(mcardHtml).join('')}</div>
</section>` : ''}

<div class="wrap"><div class="trust">${trust.items.map((t) => `<div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${TRUST[t.icon]}"/></svg><b>${esc(t.title)}</b><span>${esc(t.body)}</span></div>`).join('')}</div></div>`;
    return shell({
      path: '/', title: store.seo.homeTitle, description: store.store.description, nav: '', mnav: 'home', body: html,
      preload: lcp ? `<link rel="preload" as="image" href="${lcp.images.thumb}" fetchpriority="high">\n` : '',
      jsonLd: [{ '@context': 'https://schema.org', '@type': 'Store', name: store.store.name, description: store.store.description, url: site, logo: site + store.brand.logo, telephone: `+${contact.whatsapp}`, areaServed: 'KE' }],
    });
  }

  /* ----- shop ----- */
  function shopPage() {
    const soon = pages.shop.accessoriesSoon;
    const html = `<div class="wrap">
  <div class="phead"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Shop</span></nav><h1 id="shopTitle">All kits</h1></div>
  <div class="tools">
    <label class="searchbox" for="q">${SVG.search}<input id="q" type="search" placeholder="Search club, colour or style" autocomplete="off"></label>
    <div class="chips" id="clubs" role="group" aria-label="Filter by club"><button class="chip" data-fclub="all" aria-pressed="true">All clubs <em>${products.length}</em></button>${stockedClubs.map((c) => `<button class="chip" style="${clubVars(c.slug)}" data-fclub="${c.slug}" aria-pressed="false">${crest(c.slug)}${esc(c.name)} <em>${counts[c.slug]}</em></button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Filter by kit type">${['all', ...kitTypes].map((t) => `<button class="chip" data-ftype="${t}" aria-pressed="${t === 'all'}">${t === 'all' ? 'All styles' : esc(t)}</button>`).join('')}</div>
    <div class="toolrow"><span class="count" id="count" aria-live="polite">${products.length} kits</span><label class="count" for="sort">Sort <select id="sort"><option value="featured">Featured</option><option value="new">Newest</option><option value="club">Club A–Z</option></select></label></div>
  </div>
  <div class="grid" id="shopGrid">${products.map((p, i) => cardHtml(p, i, { lazy: i > 3 })).join('')}
    <p class="empty-r" id="shopEmpty" hidden>No kits match that. Try another club or clear the search.</p>
    <div class="soon"><div><b>${esc(soon.title)}</b><p>${esc(soon.body)}</p></div><a class="btn btn--green" href="https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(soon.message)}" target="_blank" rel="noopener">${esc(soon.cta)}</a></div>
  </div>
</div>`;
    return shell({ path: '/shop', title: titleOf('Shop kits'), description: `Browse ${products.length} club jerseys from ${stockedClubs.length} clubs, every kit KSh ${products[0].price.toLocaleString('en-KE')}. Order on WhatsApp, pay with M-Pesa.`, nav: 'shop', mnav: 'shop', body: html });
  }

  /* ----- product ----- */
  const sizeTable = () => { const g = store.catalog.sizeGuide; return `<div class="tbl"><table><thead><tr><th>Size</th><th>Chest (${g.unit})</th><th>Length (${g.unit})</th></tr></thead><tbody>${g.rows.map((r) => `<tr><td>${r.size}</td><td>${r.chest}</td><td>${r.length}</td></tr>`).join('')}</tbody></table></div>`; };
  function productPage(p) {
    const rel = [...products.filter((x) => x.club === p.club && x.slug !== p.slug), ...products.filter((x) => x.club !== p.club)].slice(0, 4);
    const printOn = offers.print?.enabled !== false && p.printable;
    const hasGuide = posts.some((x) => x.slug === 'size-guide'), hasCare = posts.some((x) => x.slug === 'jersey-care');
    const html = `<div class="wrap">
  <nav class="crumbs" style="margin-top:22px" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/shop?club=${p.club}">${esc(p.clubName)}</a><span>/</span><span>${esc(p.name)}</span></nav>
  <div class="pd" id="pd" data-slug="${p.slug}">
    <div class="pd__img"><img src="${p.images.card}" alt="${esc(p.name)}" width="800" height="1000" fetchpriority="high"><span class="kno">No.${p.no}</span>${badgeHtml(p)}</div>
    <div class="pd__info">
      <span class="eyebrow pcl"><img class="cr" src="${clubs[p.club].crest}" alt="">${esc(p.clubName)} · ${esc(p.kitType)} kit</span>
      <h1>${esc(p.name)}</h1>${priceHtml(p)}
      <p class="desc">${esc(p.description)}</p>
      <div role="group" aria-labelledby="szLbl"><div class="lbl"><span id="szLbl">Size</span><button type="button" id="toGuide">Size guide</button></div><div class="sizes">${p.sizes.map((s) => `<button type="button" class="sz" data-psize="${s}" aria-pressed="false">${s}</button>`).join('')}</div></div>
      ${printOn ? `<div class="printbox">
        <label class="switch" for="printOn"><span><b>Add name &amp; number</b><small>Printed on the back · +${ksh(offers.print.fee)}</small></span><input type="checkbox" id="printOn"></label>
        <div id="printFields" hidden>
          <div class="printf"><div class="field"><label for="pName">Name</label><input id="pName" maxlength="${offers.print.nameMaxLength}" placeholder="e.g. OTIENO" autocomplete="off"></div><div class="field"><label for="pNum">Number</label><input id="pNum" inputmode="numeric" maxlength="2" placeholder="10" autocomplete="off"></div></div>
          <div class="back" style="margin-top:12px"><span id="bName">YOUR NAME</span><b id="bNum">00</b><small>Back print preview</small></div>
        </div>
      </div>` : '<div id="printFields" hidden></div>'}
      <p class="err" id="pdErr" role="alert"></p>
      <div class="buy"><div class="qty"><button type="button" data-pq="-1" aria-label="Less">−</button><span id="pdQ" aria-live="polite">1</span><button type="button" data-pq="1" aria-label="More">+</button></div><button class="btn btn--red" id="pdAdd">Add to bag · <span id="pdTotal">${ksh(p.price)}</span></button></div>
      ${PREVIEW ? '<span class="btn btn--green" id="pdWa" aria-disabled="true">Ordering opens at launch</span>' : `<a class="btn btn--green" id="pdWa" href="https://wa.me/${contact.whatsapp}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>Order this on WhatsApp</a>`}
      <div class="acc">
        <details id="guideAcc"><summary>Size guide</summary><div class="in"><p>${esc(store.catalog.sizeGuide.note)}</p>${sizeTable()}${hasGuide ? '<p style="margin-top:10px"><a href="/magazine/size-guide" class="ulink">Read the full guide</a></p>' : ''}</div></details>
        <details><summary>Delivery &amp; payment</summary><div class="in"><p>Nairobi: doorstep delivery. Upcountry: Pickup or courier to your town.</p><p>We confirm stock and the delivery fee on WhatsApp, then you pay with M-Pesa.</p></div></details>
        <details><summary>Care</summary><div class="in"><p>Wash inside out in cold water, dry in the shade, and never iron directly on prints.${hasCare ? ' <a href="/magazine/jersey-care" class="ulink">Full care guide</a>' : ''}</p></div></details>
      </div>
    </div>
  </div>
  <section class="sec"><div class="sec-head"><div><span class="eyebrow">Keep scrolling</span><h2>You might also like</h2></div></div><div class="grid">${rel.map((x, i) => cardHtml(x, i)).join('')}</div></section>
</div>`;
    return shell({
      path: `/product/${p.slug}`, title: titleOf(p.name), description: `${p.name}: ${p.description} ${ksh(p.price)}. Order on WhatsApp, pay with M-Pesa.`, nav: 'shop', mnav: 'shop', body: html, image: p.images.card, ogType: 'product',
      preload: `<link rel="preload" as="image" href="${p.images.card}" fetchpriority="high">\n`,
      jsonLd: [{ '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: site + p.images.card, description: p.description, sku: p.sku, brand: { '@type': 'Brand', name: 'GBRAND' }, offers: { '@type': 'Offer', priceCurrency: p.currency || 'KES', price: String(p.price), availability: 'https://schema.org/InStock', url: `${site}/product/${p.slug}` } }],
    });
  }

  /* ----- brand ----- */
  function brandPage() {
    const b = pages.brand;
    const html = `<div class="bhero"><div class="wrap">${logoImg('light')}<h1>${esc(b.heroHeading)}</h1><p>${esc(b.intro)}</p></div></div>
<div class="flag"></div>
<section class="sec wrap">
  <div class="sec-head"><div><span class="eyebrow">What we stand for</span><h2>${esc(b.promisesTitle)}</h2></div></div>
  <div class="values">${b.promises.map((x, i) => `<div><b>${String(i + 1).padStart(2, '0')}</b><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p></div>`).join('')}</div>
</section>
<section class="sec wrap">
  <div class="sec-head"><div><span class="eyebrow">How to order</span><h2>${esc(b.stepsTitle)}</h2></div></div>
  <ol class="steps" style="list-style:none;padding:0;margin:0">${b.steps.map((x) => `<li class="step"><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p></li>`).join('')}</ol>
</section>
<section class="sec wrap">
  <div class="contact">
    <div><span class="eyebrow">Talk to us</span><h2 style="margin:10px 0 14px">${esc(b.contactTitle)}</h2>
      <div class="phone"><b id="phoneTxt">${esc(contact.phoneDisplay)}</b><button class="btn btn--line" id="copyPhone" data-number="${phoneRaw}" style="height:40px;padding:0 14px">Copy number</button></div></div>
    <a class="btn btn--green" href="${waGeneral}" target="_blank" rel="noopener">Chat on WhatsApp</a>
  </div>
</section>`;
    return shell({ path: '/brand', title: titleOf(b.title), description: b.metaDescription, nav: 'brand', mnav: '', body: html });
  }

  /* ----- magazine ----- */
  function magazinePage() {
    const cats = ['All', ...new Set(posts.map((p) => p.category))];
    const latest = posts[0];
    const issue = latest ? `Issue 01 · ${MONTHS_LONG[+latest.date.slice(5, 7) - 1]} ${latest.date.slice(0, 4)}` : 'Issue 01';
    const feat = (f) => `<a href="/magazine/${f.slug}" class="feat" data-cat="${esc(f.category)}" data-slug="${f.slug}"${f === latest ? '' : ' hidden'}><div class="feat__img"><img src="${f.cover}" alt="" width="800" height="1000"></div><div class="wrapc"><div class="mmeta"><b>${esc(f.category)}</b><span>${fmtDate(f.date)}</span><span>${f.readingMinutes} min read</span></div><h2>${esc(f.title)}</h2><p>${esc(f.excerpt)}</p><span class="ulink">Read the story</span></div></a>`;
    const html = `<div class="wrap" id="mag">
  <div class="mast"><span class="eyebrow">GBRAND Magazine</span><h1>The Legacy</h1>
    <div class="mast__row"><span>${issue}</span><span>${cats.slice(1).join(' · ')}</span></div></div>
  <div class="chips" role="group" aria-label="Filter stories" style="margin-top:18px">${cats.map((c) => `<button class="chip" data-mcat="${esc(c)}" aria-pressed="${c === 'All'}">${esc(c)}</button>`).join('')}</div>
  <div>${posts.map(feat).join('')}</div>
  <div class="mgrid" style="margin-top:28px">${posts.map((p) => mcardHtml(p).replace('class="mcard"', `class="mcard"${p === latest ? ' hidden' : ''}`)).join('')}</div>
</div>`;
    return shell({ path: '/magazine', title: titleOf('The Legacy · GBRAND Magazine').replace('· GBRAND · GBRAND', '· GBRAND'), description: 'Kit guides, size help and matchday style from the GBRAND team.', nav: 'magazine', mnav: 'magazine', body: html });
  }
  function postPage(po) {
    const more = posts.filter((x) => x.slug !== po.slug).slice(0, 3);
    const rel = po.related.map((s) => products.find((p) => p.slug === s)).filter(Boolean);
    const h2s = [...po.body.matchAll(/^##\s+(.*)$/gm)].map((m) => ({ text: m[1].trim(), id: slugify(m[1]) }));
    const toc = h2s.length >= 2 ? `<nav class="toc" aria-label="In this guide"><b>In this guide</b>${h2s.map((h) => `<a href="#${h.id}">${inlineMd(h.text)}</a>`).join('')}</nav>` : '';
    const waMsg = `Hi GBRAND, I just read \u201c${po.title}\u201d. `;
    const html = `<div class="wrap" id="post" data-slug="${po.slug}">
<article class="post"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/magazine">Magazine</a><span>/</span><span>${esc(po.category)}</span></nav>
  <div class="post__head"><div class="mmeta"><b>${esc(po.category)}</b><span>${fmtDate(po.date)}</span><span>${po.readingMinutes} min read</span><span>By the ${esc(po.author)}</span></div>
  <h1>${esc(po.title)}</h1><p class="lede">${esc(po.excerpt)}</p></div>
  <div class="post__cover"><img src="${po.cover}" alt="" width="800" height="1000"></div>
  <div class="post__grid"><div class="post__body prose">${renderMarkdown(po.body)}</div>
  <aside class="post__aside">${toc}
    ${rel.length ? `<div class="shopstory"><h3>Shop the story</h3><div class="minirow">${rel.map((p) => `<a href="/product/${p.slug}" class="mini"><div><img src="${p.images.thumb}" alt="${esc(p.name)}" width="400" height="500" loading="lazy"></div><b>${esc(p.name)}</b><span>${ksh(p.price)}</span></a>`).join('')}</div></div>` : ''}
    <a class="btn btn--green" href="https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(waMsg)}" target="_blank" rel="noopener">Ask us on WhatsApp</a>
  </aside></div>
</article>
${more.length ? `<section class="sec"><div class="sec-head"><div><span class="eyebrow">Keep reading</span><h2>More from The Legacy</h2></div></div><div class="mgrid">${more.map(mcardHtml).join('')}</div></section>` : ''}
</div>`;
    return shell({
      path: `/magazine/${po.slug}`, title: `${po.title} · GBRAND Magazine`, description: po.excerpt, nav: 'magazine', mnav: 'magazine', body: html, image: po.cover, ogType: 'article',
      jsonLd: [{ '@context': 'https://schema.org', '@type': 'Article', headline: po.title, description: po.excerpt, image: site + po.cover, datePublished: po.date, author: { '@type': 'Organization', name: 'GBRAND' }, publisher: { '@type': 'Organization', name: 'GBRAND', logo: { '@type': 'ImageObject', url: site + store.brand.logo } }, mainEntityOfPage: `${site}/magazine/${po.slug}` }],
    });
  }
  function notFoundPage() {
    const html = `<div class="wrap notfound"><span class="eyebrow">Error 404</span><h1>Offside</h1><p>That page isn't on the pitch. Head back to the kits or catch up on the magazine.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><a href="/shop" class="btn btn--red">Shop kits</a><a href="/magazine" class="btn btn--line">Read the magazine</a></div></div>`;
    return shell({ path: '/404', title: titleOf('Page not found'), description: 'Page not found.', nav: '', mnav: '', body: html });
  }

  /* ----- assemble ----- */
  put('index.html', homePage());
  put('shop.html', shopPage());
  put('brand.html', brandPage());
  put('magazine.html', magazinePage());
  put('404.html', notFoundPage());
  for (const p of products) put(`product/${p.slug}.html`, productPage(p));
  for (const po of posts) put(`magazine/${po.slug}.html`, postPage(po));

  const urls = ['/', '/shop', '/brand', '/magazine', ...products.map((p) => `/product/${p.slug}`), ...posts.map((p) => `/magazine/${p.slug}`)];
  if (!PREVIEW) put('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u === '/' ? '' : u}</loc></url>`).join('\n')}\n</urlset>\n`);
  put('robots.txt', PREVIEW ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  put('gbrand.css', rt('gbrand.css'));
  if (PREVIEW) put('_preview.json', JSON.stringify({ id: previewCfg.id, created: previewCfg.created, expiresDays: previewCfg.expiresDays }));
  put('gbrand.js', rt('gbrand.js'));
  put('cart-logic.js', rt('cart-logic.js'));
  put('catalog.js', catalogJs);

  // Binary assets: product photos, crests and logos at their handoff paths, plus the generated favicon set.
  const copyDir = (from, to) => {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      if (e.isDirectory()) copyDir(path.join(from, e.name), `${to}/${e.name}`);
      else put(`${to}/${e.name}`, fs.readFileSync(path.join(from, e.name)));
    }
  };
  copyDir(path.join(DATA, 'assets'), 'assets');
  if (fs.existsSync(path.join(DATA, 'brand'))) {
    copyDir(path.join(DATA, 'brand'), 'brand');
    if (files.has('brand/favicon.ico')) put('favicon.ico', files.get('brand/favicon.ico'));
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const e of fs.readdirSync(outDir)) fs.rmSync(path.join(outDir, e), { recursive: true, force: true });
  for (const [f, c] of files) { const t = path.join(outDir, f); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, c); }
  return { files, outDir, base, products: products.length, posts: posts.length, pages: [...files.keys()].filter((f) => f.endsWith('.html')).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--out');
  try {
    const r = await buildGbrand({ outDir: oi >= 0 ? path.resolve(args[oi + 1]) : undefined, preview: !args.includes('--live') });
    console.log(`  ✓ store gbrand${r.base ? ` preview at ${r.base}/` : ' (live)'}: ${r.pages} pages (${r.products} kits, ${r.posts} posts) → ${path.relative(ROOT, r.outDir)}`);
  } catch (e) {
    console.error(e instanceof BuildError ? `✗ ${e.message}` : e);
    process.exit(1);
  }
}
