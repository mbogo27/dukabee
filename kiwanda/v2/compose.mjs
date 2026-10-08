// Store homepage formula (Duka Bee v2 Phase 3): a closed section vocabulary, recipes that order it, and rules that
// decide what renders. composeHomepage is a pure function of the store config and catalog; it returns the sections
// to render, each with its resolved data (banners with hrefs and interpolated copy, rail products, tabs, …), so the
// renderer never has to make a decision.
import { parseQuery, serializeQuery, results, sortProducts, formatKsh } from './catalog.mjs';

export const TIERS = { starter: 1, growing: 9, full: 31 };
export const tierOf = (n, tiers = TIERS) => (n >= tiers.full ? 'full' : n >= tiers.growing ? 'growing' : 'starter');
const TIER_RANK = { starter: 0, growing: 1, full: 2 };

// Recipes (spec 3.4). `alt` is what a slot becomes below its minTier, where the recipe gives one.
export const RECIPES = {
  marketplace: [
    { type: 'announcement', variant: 'static', minTier: 'growing' },
    { type: 'hero', variant: 'split', minTier: 'growing', alt: { variant: 'spotlight' } },
    { type: 'categoryNav', variant: 'circles', minTier: 'growing', title: 'Shop by category' },
    { type: 'productRail', variant: 'tabs', minTier: 'growing', title: 'Shop now', source: { tabs: [{ label: 'New', source: 'new' }, { label: 'Bestsellers', source: 'bestseller' }, { label: 'On offer', source: 'onOffer' }] }, alt: { variant: 'grid', source: 'featured', title: 'Featured' } },
    { type: 'promoBanner', variant: 'twoUp', minTier: 'growing' },
    { type: 'offerCountdown', variant: 'strip', minTier: 'growing' },
    { type: 'productRail', variant: 'carousel', minTier: 'full', title: 'Bestsellers', source: 'bestseller' },
    { type: 'promoBanner', variant: 'threeUp', minTier: 'full' },
    { type: 'productRail', variant: 'grid', minTier: 'full', source: { category: '{largest}' } },
    { type: 'trustStrip', variant: 'icons' },
    { type: 'footer', variant: 'standard' },
  ],
  editorial: [
    { type: 'hero', variant: 'slider', minTier: 'growing', alt: { variant: 'spotlight' } },
    { type: 'categoryNav', variant: 'tiles', minTier: 'growing', title: 'Shop by category' },
    { type: 'productRail', variant: 'grid', title: 'New in', source: 'new' },
    { type: 'promoBanner', variant: 'twoUp', minTier: 'growing' },
    { type: 'productShowcase', variant: 'left', minTier: 'growing' },
    { type: 'productRail', variant: 'carousel', minTier: 'growing', title: 'Bestsellers', source: 'bestseller' },
    { type: 'promoBanner', variant: 'full', minTier: 'full' },
    { type: 'trustStrip', variant: 'icons' },
    { type: 'footer', variant: 'standard' },
  ],
  playful: [
    { type: 'hero', variant: 'banner' },
    { type: 'categoryNav', variant: 'tiles', minTier: 'growing', title: 'Shop by category' },
    { type: 'productRail', variant: 'carousel', title: 'Featured', source: 'featured', alt: { variant: 'grid' }, altBelow: 'growing' },
    { type: 'promoBanner', variant: 'threeUp', minTier: 'growing' },
    { type: 'announcement', variant: 'marquee', minTier: 'growing' },
    { type: 'productRail', variant: 'grid', minTier: 'full', title: 'Bestsellers', source: 'bestseller' },
    { type: 'offerCountdown', variant: 'block', minTier: 'growing' },
    { type: 'trustStrip', variant: 'icons' },
    { type: 'footer', variant: 'standard' },
  ],
};
export const NICHE_RECIPE = { electronics: 'marketplace', kitchen: 'marketplace', fashion: 'editorial', shoes: 'editorial', beauty: 'editorial', baby: 'playful', fitness: 'playful', home: 'playful' };

const RAIL_MIN = 4;
const TARGET_MIN = 3;
const BANNERS_NEEDED = { split: 3, slider: 2, banner: 1, full: 1, twoUp: 2, threeUp: 3 };

/**
 * @param store   { name, niche, recipe?, announcement?, policies[], sections? }
 * @param catalog { products (public), categories, banners, attributes, priceBuckets, guides?, now? }
 * @param report  optional object that receives { tier, recipe, dropped[], warnings[] }
 * @returns resolved sections, in render order
 */
export function composeHomepage(store, catalog, report = {}) {
  const now = catalog.now ? new Date(catalog.now) : new Date();
  const attrKeys = (catalog.attributes || []).map((a) => a.key);
  const inStock = catalog.products.filter((p) => p.stock !== 'out');
  const ctx = { termsOf: (p) => p.terms || [], buckets: catalog.priceBuckets || [] };
  const tier = tierOf(inStock.length, catalog.tiers);
  const recipe = store.recipe || NICHE_RECIPE[store.niche] || 'marketplace';
  Object.assign(report, { tier, recipe, dropped: [], warnings: [] });
  const drop = (s, why) => report.dropped.push({ type: s.type, variant: s.variant, title: s.title, why });

  // ---- resolvers ----
  const categoryProducts = (id) => inStock.filter((p) => p.categoryId === id);
  const shopHref = (q) => { const s = serializeQuery(q, attrKeys); return `/shop${s ? `?${s}` : ''}`; };
  const offerLive = (p) => p.compareAtPrice > p.price && p.offerEndsAt && new Date(p.offerEndsAt) > now;

  function resolveSource(src) {
    // Featured tops up with the rest of the catalog when a small store has flagged fewer than a rail's worth.
    if (src === 'featured') {
      const picks = sortProducts(inStock.filter((p) => p.featured));
      return { products: picks.length >= RAIL_MIN ? picks : [...picks, ...sortProducts(inStock.filter((p) => !p.featured))], href: '/shop' };
    }
    if (src === 'bestseller') return { products: sortProducts(inStock.filter((p) => p.bestseller)), href: '/shop' };
    if (src === 'onOffer') return { products: inStock.filter(offerLive), href: '/shop' };
    if (src === 'new') {
      const recent = inStock.filter((p) => now - new Date(p.createdAt) <= 30 * 864e5);
      const list = sortProducts(recent.length >= RAIL_MIN ? recent : inStock, 'newest');
      return { products: recent.length >= RAIL_MIN ? list : list.slice(0, 8), href: '/shop?sort=newest' };
    }
    if (src && typeof src === 'object' && 'category' in src) {
      const q = { ...parseQuery({ category: src.category }, attrKeys), sort: src.sort || 'recommended' };
      return { products: sortProducts(categoryProducts(src.category), q.sort), href: shopHref(q) };
    }
    if (src && typeof src === 'object' && 'filter' in src) {
      const q = parseQuery(src.filter, attrKeys);
      if (src.sort) q.sort = src.sort;
      return { products: results(inStock, q, ctx), href: shopHref(q) };
    }
    return { products: [], href: '/shop' };
  }

  function resolveTarget(t) {
    if (!t) return null;
    if (t.type === 'url') return { href: t.href, products: [] };
    if (t.type === 'product') { const p = inStock.find((x) => x.id === t.id || x.slug === t.id); return p ? { href: `/p/${p.slug}`, products: [p] } : null; }
    if (t.type === 'offer') { const ps = inStock.filter(offerLive); return ps.length ? { href: '/shop', products: ps } : null; }
    if (t.type === 'category') { const ps = categoryProducts(t.id); return ps.length >= TARGET_MIN ? { href: shopHref(parseQuery({ category: t.id }, attrKeys)), products: ps } : null; }
    if (t.type === 'filter') {
      const q = parseQuery(t.query || {}, attrKeys);
      const ps = results(inStock, q, ctx);
      return ps.length >= TARGET_MIN ? { href: shopHref(q), products: ps } : null;
    }
    return null;
  }

  // {count} = in-stock products in the target, {fromPrice} = its lowest price. Unresolvable tokens drop the banner.
  function resolveBanner(id) {
    const b = (catalog.banners || []).find((x) => x.id === id);
    if (!b) return null;
    const target = resolveTarget(b.target);
    if (!target) return null;
    const tokens = { count: target.products.length || null, fromPrice: target.products.length ? formatKsh(Math.min(...target.products.map((p) => p.price))) : null };
    let ok = true;
    const fill = (s) => (s == null ? s : String(s).replace(/\{(\w+)\}/g, (m, k) => { if (tokens[k] == null) ok = false; return tokens[k] ?? m; }));
    const out = { ...b, headline: fill(b.headline), sub: fill(b.sub), cta: fill(b.cta), href: target.href, count: tokens.count };
    return ok ? out : null;
  }

  // ---- 1. sections: explicit list (validated with the same rules) or the recipe, filtered by tier ----
  const explicit = Array.isArray(store.sections) && store.sections.length;
  let sections = (explicit ? store.sections : RECIPES[recipe]).map((s) => ({ ...s })).filter((s) => {
    const below = s.minTier && TIER_RANK[tier] < TIER_RANK[s.minTier];
    if (s.altBelow && TIER_RANK[tier] < TIER_RANK[s.altBelow]) Object.assign(s, s.alt);
    else if (below && s.alt && !explicit) { Object.assign(s, s.alt); return true; }
    if (below) { drop(s, `needs the ${s.minTier} tier`); return false; }
    return true;
  });

  // Recipe slots don't name banners: hand them out in order (hero banners to heroes, promos to promo slots).
  if (!explicit) {
    const heroes = (catalog.banners || []).filter((b) => b.kind === 'hero').map((b) => b.id);
    const promos = (catalog.banners || []).filter((b) => b.kind === 'promo').map((b) => b.id);
    for (const s of sections) {
      if (s.type === 'hero' && s.variant === 'split') s.bannerIds = [heroes.shift(), promos.shift(), promos.shift()].filter(Boolean);
      else if (s.type === 'hero' && s.variant !== 'spotlight') s.bannerIds = heroes.splice(0, s.variant === 'slider' ? 3 : 1);
      else if (s.type === 'promoBanner') s.bannerIds = promos.splice(0, BANNERS_NEEDED[s.variant]);
      if (s.source?.category === '{largest}') {
        const largest = (catalog.categories || []).map((c) => ({ c, n: categoryProducts(c.id).length })).sort((a, b) => b.n - a.n)[0];
        if (largest) { s.source = { category: largest.c.id }; s.title ||= largest.c.name; s.seeAll = true; }
      }
    }
  }

  // ---- 2. rule 1: resolve each section; drop what fails its "renders only if" ----
  const resolve = (s) => {
    switch (s.type) {
      case 'announcement': return store.announcement ? { text: store.announcement } : null;
      case 'hero': {
        if (s.variant === 'spotlight') {
          const p = inStock.find((x) => x.id === s.productId) || sortProducts(inStock.filter((x) => x.featured))[0] || sortProducts(inStock)[0];
          return p ? { product: p, products: [p] } : null;
        }
        const banners = (s.bannerIds || []).map(resolveBanner);
        if (s.variant === 'split') {
          const [main, ...tiles] = banners;
          return main && tiles.length === 2 && tiles.every(Boolean) ? { main, tiles } : null;
        }
        const ok = banners.filter(Boolean);
        return ok.length >= BANNERS_NEEDED[s.variant] ? { banners: ok } : null;
      }
      case 'categoryNav': {
        const cats = (catalog.categories || []).map((c) => ({ ...c, count: categoryProducts(c.id).length, href: shopHref(parseQuery({ category: c.id }, attrKeys)) })).filter((c) => c.count >= 1);
        return cats.length >= 3 ? { categories: cats } : null;
      }
      case 'productRail': {
        if (s.source && typeof s.source === 'object' && 'tabs' in s.source) {
          const tabs = s.source.tabs.map((t) => {
            const r = resolveSource(t.source);
            return { label: t.label, all: r.products, href: r.href, sort: t.source?.sort };
          });
          return { tabs };
        }
        const r = resolveSource(s.source);
        const products = s.sort ? sortProducts(r.products, s.sort) : r.products;
        const href = s.sort && typeof s.source === 'object' ? r.href.includes('sort=') ? r.href : `${r.href}${r.href.includes('?') ? '&' : '?'}sort=${s.sort}` : r.href;
        return { all: products, href };
      }
      case 'promoBanner': {
        const banners = (s.bannerIds || []).map(resolveBanner);
        return banners.length === BANNERS_NEEDED[s.variant] && banners.every(Boolean) ? { banners } : null;
      }
      case 'offerCountdown': {
        const ps = inStock.filter(offerLive);
        return ps.length ? { products: ps, endsAt: ps.map((p) => p.offerEndsAt).sort()[0] } : null;
      }
      case 'trustStrip': return (store.policies || []).length >= 2 ? { items: store.policies } : null;
      case 'productShowcase': {
        const p = inStock.find((x) => x.id === s.productId || x.slug === s.productId) || sortProducts(inStock.filter((x) => x.featured))[0];
        return p ? { product: p, products: [p] } : null;
      }
      case 'guideTeaser': {
        const guides = (catalog.guides || []).slice().sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
        return guides.length ? { guides: s.variant === 'list' ? guides.slice(0, 3) : guides.slice(0, 1) } : null;
      }
      case 'footer': return {};
      default: return null;
    }
  };
  sections = sections.filter((s) => {
    const data = resolve(s);
    if (!data) { drop(s, 'its content did not resolve'); return false; }
    s.data = data;
    return true;
  });

  // ---- rule 5: at most one announcement, trust strip, offer countdown (and one footer) ----
  const singletons = new Set();
  sections = sections.filter((s) => {
    if (!['announcement', 'trustStrip', 'offerCountdown', 'footer', 'hero'].includes(s.type)) return true;
    if (singletons.has(s.type)) { drop(s, 'only one allowed'); return false; }
    singletons.add(s.type);
    return true;
  });

  // ---- rule 2: hero first (after an optional announcement); without one, promote a showcase or the first rail ----
  let hero = sections.find((s) => s.type === 'hero');
  if (!hero) {
    const promote = sections.find((s) => s.type === 'productShowcase') || sections.find((s) => s.type === 'productRail');
    if (promote) {
      const p = promote.data.product || promote.data.all?.[0] || promote.data.tabs?.[0]?.all?.[0];
      if (p) {
        if (promote.type === 'productShowcase') sections = sections.filter((s) => s !== promote);
        hero = { type: 'hero', variant: 'spotlight', data: { product: p, products: [p] }, promoted: true };
        report.warnings.push(`No hero resolved; promoted ${promote.type} to a spotlight hero.`);
      }
    }
  }
  if (hero) {
    sections = sections.filter((s) => s !== hero);
    const at = sections[0]?.type === 'announcement' ? 1 : 0;
    sections.splice(at, 0, hero);
  }

  // ---- rule 6: trust strip, then footer, last ----
  const tail = ['trustStrip', 'footer'].map((t) => sections.find((s) => s.type === t)).filter(Boolean);
  sections = [...sections.filter((s) => !tail.includes(s)), ...tail];

  // ---- rules 3 + 4, repeated until stable: separate adjacent rails, then cap each product at 2 appearances ----
  for (let pass = 0; pass < 5; pass++) {
    // rule 3
    for (let i = 0; i < sections.length - 1; i++) {
      if (sections[i].type !== 'productRail' || sections[i + 1].type !== 'productRail') continue;
      const j = sections.findIndex((s, k) => k > i + 1 && ['promoBanner', 'productShowcase'].includes(s.type));
      if (j > 0) sections.splice(i + 1, 0, sections.splice(j, 1)[0]);
      else { drop(sections[i + 1], 'adjacent to another rail with nothing to separate them'); sections.splice(i + 1, 1); }
    }
    // rule 4
    const seen = new Map();
    const take = (list, limit) => {
      const picked = [];
      for (const p of list) { if (picked.length >= limit) break; if ((seen.get(p.slug) || 0) < 2) picked.push(p); }
      return picked;
    };
    const mark = (list) => { for (const slug of new Set(list.map((p) => p.slug))) seen.set(slug, (seen.get(slug) || 0) + 1); };
    let changed = false;
    sections = sections.filter((s) => {
      if (s.type === 'productRail') {
        const limit = s.limit || 8;
        if (s.data.tabs) {
          s.data.tabs.forEach((t) => { t.products = take(t.all, limit); });
          const before = s.data.tabs.length;
          const kept = s.data.tabs.filter((t) => t.products.length >= RAIL_MIN);
          if (kept.length < before) s.data.tabs.filter((t) => !kept.includes(t)).forEach((t) => report.dropped.push({ type: 'tab', title: t.label, why: `fewer than ${RAIL_MIN} products` }));
          if (kept.length === 0) { drop(s, 'no tab has enough products'); changed = true; return false; }
          if (kept.length < 2) { s.variant = 'grid'; s.data = { all: kept[0].all, products: kept[0].products, href: kept[0].href }; s.title ||= kept[0].label; }
          else s.data.tabs = kept;
          mark((s.data.tabs || [s.data]).flatMap((t) => t.products));
          return true;
        }
        s.data.products = take(s.data.all, limit);
        if (s.data.products.length < RAIL_MIN) { drop(s, `fewer than ${RAIL_MIN} products after the 2-appearance cap`); changed = true; return false; }
        mark(s.data.products);
        return true;
      }
      if (s.data?.products) mark(s.data.products);
      return true;
    });
    if (!changed) break;
  }

  // ---- rule 7: a starter page still needs hero, a product grid, trust strip and footer ----
  if (tier === 'starter') for (const need of ['hero', 'productRail', 'trustStrip', 'footer']) if (!sections.some((s) => s.type === need)) report.warnings.push(`Starter page is missing a ${need}.`);
  return sections;
}
