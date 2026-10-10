// Product tree (Site Structure Spec): category → brand → series → model → offers, built purely from data.
// The model owns the URL (/<category>/<model-slug>); offers (sellable configurations) have no URL of their own and
// are selected on the model page with ?variant=<offer-slug>. Hierarchy lives in data and breadcrumbs, never in paths.
import { parseRange, inRange, formatKsh } from './catalog.mjs';

const kShort = (n) => (n % 1000 === 0 ? `${n / 1000}K` : n.toLocaleString('en-KE'));
export const priceRangeText = (r) => (!r ? '' : r.lo === r.hi ? formatKsh(r.lo) : `${formatKsh(r.lo)} – ${Math.round(r.hi).toLocaleString('en-KE')}`);
export const priceRangeShort = (r) => (!r ? '' : r.lo === r.hi ? `KSh ${kShort(r.lo)}` : `KSh ${kShort(r.lo)}–${kShort(r.hi)}`);
const range = (offers) => (offers.length ? { lo: Math.min(...offers.map((o) => o.price)), hi: Math.max(...offers.map((o) => o.price)) } : null);
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const a = (o, k) => o.attributes?.[k] || [];
const cpuShort = (c) => c.replace(/^Intel (Core )?|^AMD /, '');

/** "Core i5–i7 · 8–16GB · 256–512GB · 14"" from a model's offers. */
export function typicalSpecs(offers, model) {
  const span = (vals, unit = '') => {
    const nums = uniq(vals).map((v) => parseInt(v, 10)).filter(Number.isFinite).sort((x, y) => x - y);
    if (!nums.length) return '';
    return nums.length === 1 ? `${nums[0]}${unit}` : `${nums[0]}–${nums.at(-1)}${unit}`;
  };
  const cpus = uniq(offers.flatMap((o) => a(o, 'cpu'))).map(cpuShort);
  return [cpus.join(' / '), span(offers.flatMap((o) => a(o, 'ram')), 'GB'), span(offers.flatMap((o) => a(o, 'storage')), 'GB'), model.screenInches ? `${model.screenInches}"` : '']
    .filter(Boolean).join(' · ');
}

/** "8th Gen Intel", "6th–8th Gen Intel", "AMD Ryzen 3000-series", "4th Gen Intel". */
export function generationText(offers, model) {
  const gens = uniq(offers.flatMap((o) => a(o, 'cpuGen'))).map((g) => parseInt(g, 10)).sort((x, y) => x - y);
  if (gens.length) {
    const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
    return gens.length === 1 ? `${ord(gens[0])} Gen Intel` : `${ord(gens[0])}–${ord(gens.at(-1))} Gen Intel`;
  }
  if (model.typicalRyzenSeries) return `AMD Ryzen ${model.typicalRyzenSeries}-series`;
  if (offers.some((o) => a(o, 'cpu').some((c) => /Ryzen/.test(c)))) return 'AMD Ryzen';
  if (offers.some((o) => a(o, 'cpu').includes('Intel Celeron'))) return 'Intel Celeron';
  return '';
}

/** Model name without its series prefix, for breadcrumbs: "HP EliteBook 840 G6" → "840 G6". */
export const modelShortName = (model, series, brand) => {
  for (const prefix of [series?.name, brand?.name]) if (prefix && model.name.startsWith(`${prefix} `)) return model.name.slice(prefix.length + 1);
  return model.name;
};

/**
 * @param {{ taxonomy, models, products, origin }} input  products = public offers (no cost)
 * @returns the tree, plus `errors` (namespace collisions, unknown series/brands) that must fail the build
 */
export function buildTree({ taxonomy, models, products, origin = '' }) {
  const errors = [];
  const tags = new Map((taxonomy.tags || []).map((t) => [t.id, t]));
  const priceBands = (taxonomy.tags || []).filter((t) => t.type === 'price_band');
  const metas = new Map((taxonomy.metaCategories || []).map((m) => [m.slug, m]));
  const offersOf = new Map();
  for (const p of products) { if (!offersOf.has(p.modelId)) offersOf.set(p.modelId, []); offersOf.get(p.modelId).push(p); }

  const categories = new Map();
  for (const c of taxonomy.categories || []) categories.set(c.slug, { ...c, meta: metas.get(c.metaCategory) || null, path: `/${c.slug}`, models: [], series: [], brands: [] });
  const series = new Map();
  for (const s of taxonomy.series || []) {
    if (!categories.has(s.category)) { errors.push(`taxonomy: series "${s.slug}" names unknown category "${s.category}"`); continue; }
    series.set(s.slug, { ...s, path: `/${s.category}/${s.slug}`, models: [] });
  }
  const brandKey = (cat, slug) => `${cat}/${slug}`;
  const brands = new Map();
  for (const b of taxonomy.brands || []) brands.set(brandKey(b.category, b.slug), { ...b, path: null, series: [] });

  const tree = new Map();
  for (const m of models) {
    const s = series.get(m.seriesSlug);
    const cat = categories.get(m.category);
    if (!s || !cat) { errors.push(`models.json: ${m.modelId} has ${!cat ? `unknown category "${m.category}"` : `unknown series "${m.seriesSlug}"`}`); continue; }
    const brand = brands.get(brandKey(m.category, m.brandSlug));
    if (!brand) errors.push(`models.json: ${m.modelId} has brand "${m.brandSlug}", which isn't listed for category "${m.category}" in taxonomy.json`);
    const offers = (offersOf.get(m.modelId) || []).slice().sort((x, y) => (x.stock === 'out') - (y.stock === 'out') || x.price - y.price);
    const available = offers.filter((o) => o.stock !== 'out');
    const path = `/${m.category}/${m.slug}`;
    for (const o of offers) { o.href = `${path}?variant=${encodeURIComponent(o.slug)}`; o.modelPath = path; o.seriesSlug = s.slug; o.categoryId = m.category; }
    const pr = range(available.length ? available : offers);
    const band = pr ? priceBands.find((t) => inRange(pr.lo, parseRange(t.range))) : null;
    const node = {
      ...m, path, url: `${origin}${path}`, category: cat, series: s, brand, offers, available,
      status: m.status === 'retired' ? 'retired' : available.length ? 'in_catalog' : 'sourceable',
      priceRange: pr, generation: generationText(offers, m), typicalSpecs: typicalSpecs(offers, m),
      tagIds: uniq([...(m.tags?.use_case || []), ...(m.tags?.feature || []), band?.id]),
      priceBand: band || null,
    };
    node.shortName = modelShortName(node, s, brand);
    tree.set(m.modelId, node);
    s.models.push(node);
    cat.models.push(node);
  }
  for (const node of tree.values()) for (const t of node.tagIds) if (!tags.has(t)) errors.push(`models.json: ${node.modelId} has tag "${t}", which isn't in the taxonomy.json vocabulary`);

  // Publishing rules: a series needs a model; a category needs an available offer (no empty categories);
  // a brand page needs 2+ stocked series in its category.
  for (const s of series.values()) {
    s.models.sort((x, y) => (x.priceRange?.lo ?? Infinity) - (y.priceRange?.lo ?? Infinity));
    s.offers = s.models.flatMap((m) => m.offers);
    s.available = s.offers.filter((o) => o.stock !== 'out');
    s.priceRange = range(s.available.length ? s.available : s.offers);
    s.published = s.models.length > 0;
    s.category = categories.get(s.category);
    s.brand = brands.get(brandKey(s.category.slug, s.brand));
    if (s.published) { s.category.series.push(s); s.brand?.series.push(s); }
  }
  for (const c of categories.values()) {
    c.offers = c.models.flatMap((m) => m.offers);
    c.available = c.offers.filter((o) => o.stock !== 'out');
    c.published = c.status !== 'hidden' && c.available.length > 0;
  }
  for (const b of brands.values()) {
    const stocked = b.series.filter((s) => s.available.length);
    if (stocked.length >= 2) { b.path = `/${b.category}/${b.slug}`; categories.get(b.category)?.brands.push(b); }
  }

  // One namespace per category: brand pages, series and models can never share a slug.
  for (const c of categories.values()) {
    const seen = new Map();
    const claim = (slug, what) => { if (seen.has(slug)) errors.push(`/${c.slug}/${slug} is claimed by both ${seen.get(slug)} and ${what}`); else seen.set(slug, what); };
    for (const b of c.brands) claim(b.slug, `brand ${b.name}`);
    for (const s of c.series) claim(s.slug, `series ${s.name}`);
    for (const m of c.models) claim(m.slug, `model ${m.name}`);
  }

  // Relations from shared tags (same category), then price proximity.
  const related = (node, n = 4) => [...node.category.models]
    .filter((x) => x !== node && x.available.length)
    .map((x) => ({ x, shared: x.tagIds.filter((t) => node.tagIds.includes(t)).length + (x.series === node.series ? 1 : 0) }))
    .sort((p, q) => q.shared - p.shared || Math.abs((p.x.priceRange?.lo || 0) - (node.priceRange?.lo || 0)) - Math.abs((q.x.priceRange?.lo || 0) - (node.priceRange?.lo || 0)))
    .slice(0, n).map((r) => r.x);

  /**
   * Breadcrumb trail for a page: [{ label, href }]; the current page and anything without a page of its own
   * (meta-categories, brands without a brand page) have href null.
   * kind: 'category' | 'brand' | 'series' | 'model'
   */
  const crumbs = (kind, node) => {
    const cat = kind === 'category' ? node : (typeof node.category === 'string' ? categories.get(node.category) : node.category);
    const out = [{ label: 'Home', href: '/' }];
    if (cat.meta) out.push({ label: cat.meta.name, href: null });
    out.push({ label: cat.name, href: kind === 'category' ? null : cat.path });
    if (kind === 'category') return out;
    const brand = kind === 'brand' ? node : node.brand;
    if (brand) out.push({ label: brand.name, href: kind === 'brand' ? null : brand.path });
    if (kind === 'brand') return out;
    const s = kind === 'series' ? node : node.series;
    out.push({ label: s.shortName || s.name, href: kind === 'series' ? null : s.path });
    if (kind === 'model') out.push({ label: node.shortName, href: null });
    return out;
  };

  return { categories, series, brands, models: tree, tags, priceBands, related, crumbs, errors };
}
