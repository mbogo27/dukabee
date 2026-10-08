// Storefront catalog engine (Duka Bee v2): attribute-schema facets, URL filter state, faceted counts, search and sort.
// Isomorphic on purpose: the build uses it to pre-render pages and resolve homepage rails, and the browser runtime
// imports the very same file for the live shop filters, so counts on the server and in the page can't disagree.
// No Node or DOM APIs in here.

export const RESERVED = ['category', 'price', 'q', 'sort'];
export const SORTS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'newest', label: 'Newest' },
];

export const formatKsh = (n) => `KSh ${Math.round(Number(n)).toLocaleString('en-KE')}`;
const kShort = (n) => (n % 1000 === 0 ? `${n / 1000}K` : Number(n).toLocaleString('en-KE'));

// ---- price ranges: "25000-35000" (lo ≤ price < hi), "60000-" open-ended ----
export function parseRange(id) {
  const m = String(id ?? '').match(/^(\d*)-(\d*)$/);
  if (!m) return null;
  return { lo: m[1] ? Number(m[1]) : 0, hi: m[2] ? Number(m[2]) : Infinity };
}
export const inRange = (price, r) => !!r && price >= r.lo && price < r.hi;
export function rangeLabel(id, buckets = []) {
  const b = buckets.find((x) => x.id === id);
  if (b) return b.label;
  const r = parseRange(id);
  if (!r) return id;
  if (r.lo === 0 && Number.isFinite(r.hi)) return `Under KSh ${kShort(r.hi)}`;
  if (!Number.isFinite(r.hi)) return `KSh ${kShort(r.lo)}+`;
  return `KSh ${kShort(r.lo)}–${kShort(r.hi)}`;
}

// ---- query state: { category, price[], q, sort, attrs{key: values[]} } <-> /shop?… ----
export function emptyQuery() { return { category: null, price: [], q: '', sort: 'recommended', attrs: {} }; }

/** Accepts URLSearchParams, a query string, or a FilterQuery object ({ ram: ["16GB","32GB"], price: "0-30000" }). */
export function parseQuery(input, attrKeys) {
  const q = emptyQuery();
  const entries = typeof input === 'string' || (typeof URLSearchParams !== 'undefined' && input instanceof URLSearchParams)
    ? [...new URLSearchParams(input).entries()]
    : Object.entries(input || {}).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v == null ? [] : [[k, v]]));
  const split = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean);
  for (const [k, v] of entries) {
    if (k === 'category') q.category = String(v).trim() || null;
    else if (k === 'q') q.q = String(v).trim();
    else if (k === 'sort') q.sort = SORTS.some((s) => s.id === v) ? v : 'recommended';
    else if (k === 'price') q.price.push(...split(v).filter((x) => parseRange(x)));
    else if (!attrKeys || attrKeys.includes(k)) (q.attrs[k] ||= []).push(...split(v));
  }
  q.price = [...new Set(q.price)];
  for (const k of Object.keys(q.attrs)) { q.attrs[k] = [...new Set(q.attrs[k])]; if (!q.attrs[k].length) delete q.attrs[k]; }
  return q;
}

const enc = (v) => encodeURIComponent(v).replace(/%20/g, '+');
/** Stable, readable query string: category, attributes in schema order, price, q, sort (recommended omitted). */
export function serializeQuery(q, attrOrder = Object.keys(q.attrs)) {
  const parts = [];
  if (q.category) parts.push(`category=${enc(q.category)}`);
  const keys = [...attrOrder.filter((k) => q.attrs[k]?.length), ...Object.keys(q.attrs).filter((k) => !attrOrder.includes(k) && q.attrs[k]?.length)];
  for (const k of keys) parts.push(`${enc(k)}=${q.attrs[k].map(enc).join(',')}`);
  if (q.price.length) parts.push(`price=${q.price.map(enc).join(',')}`);
  if (q.q) parts.push(`q=${enc(q.q)}`);
  if (q.sort && q.sort !== 'recommended') parts.push(`sort=${enc(q.sort)}`);
  return parts.join('&');
}
export const hasFilters = (q) => !!(q.category || q.price.length || q.q || Object.keys(q.attrs).length);
export const activeFilterCount = (q) => q.price.length + Object.values(q.attrs).reduce((n, v) => n + v.length, 0) + (q.q ? 1 : 0);

// ---- search: case-insensitive token prefix match, every query token must match ----
export function normalizeSearch(s) {
  return String(s ?? '').toLowerCase()
    .replace(/\b2\s*-?\s*in\s*-?\s*1\b/g, '2in1')
    .replace(/\belite\s+book\b/g, 'elitebook').replace(/\bthink\s+pad\b/g, 'thinkpad').replace(/\bmac\s+book\b/g, 'macbook');
}
export const tokenize = (s) => normalizeSearch(s).split(/[^a-z0-9]+/).filter(Boolean);
export const searchMatches = (terms, queryTokens) => queryTokens.every((t) => terms.some((x) => x.startsWith(t)));

// ---- product projections ----
const PRIVATE = ['cost', 'sourceRows', 'customDescription'];
/** Everything public about a product. `cost` (the supplier price) must never leave the build. */
export function publicProduct(p) {
  const out = {};
  for (const [k, v] of Object.entries(p)) if (!PRIVATE.includes(k)) out[k] = v;
  return out;
}
export const attr = (p, key) => p.attributes?.[key] || [];
export const attr1 = (p, key) => attr(p, key)[0];

/** Slim client index entry: what /shop needs to filter, count, search and sort without the page re-rendering. */
export function indexEntry(p, model, defs) {
  const filterable = Object.fromEntries(defs.filter((d) => d.filterable && p.attributes[d.key]).map((d) => [d.key, p.attributes[d.key]]));
  const terms = [...new Set(tokenize([p.name, p.slug, p.modelId, model?.name, attr1(p, 'brand'), attr1(p, 'series'), attr1(p, 'cpu'), attr1(p, 'ram'), attr1(p, 'storage'), ...(model?.searchAliases || [])].join(' ')))];
  return { slug: p.slug, name: p.name, modelId: p.modelId, categoryId: p.categoryId, price: p.price, stock: p.stock || 'in', featured: !!p.featured, createdAt: p.createdAt, attrs: filterable, terms };
}

// ---- matching, facets, results ----
/** ctx: { buckets } plus `termsOf(product)` for search. `except` skips one facet (for faceted counts). */
export function matches(p, q, ctx, except) {
  if (except !== 'category' && q.category && p.categoryId !== q.category) return false;
  if (except !== 'price' && q.price.length && !q.price.some((id) => inRange(p.price, parseRange(id)))) return false;
  for (const [k, vals] of Object.entries(q.attrs)) {
    if (k === except) continue;
    const have = p.attrs ? p.attrs[k] || [] : p.attributes?.[k] || [];
    if (!vals.some((v) => have.includes(v))) return false;
  }
  if (q.q && except !== 'q') {
    const qt = tokenize(q.q);
    if (qt.length && !searchMatches(ctx.termsOf(p), qt)) return false;
  }
  return true;
}

/** Out-of-stock products only show up once the shopper filters or searches, and always sort last. */
export const pool = (products, q) => (hasFilters(q) ? products : products.filter((p) => p.stock !== 'out'));

export function sortProducts(list, sort = 'recommended') {
  const out = (p) => (p.stock === 'out' ? 1 : 0);
  const cmp = {
    recommended: (a, b) => out(a) - out(b) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.price - b.price || a.name.localeCompare(b.name),
    'price-asc': (a, b) => out(a) - out(b) || a.price - b.price || a.name.localeCompare(b.name),
    'price-desc': (a, b) => out(a) - out(b) || b.price - a.price || a.name.localeCompare(b.name),
    newest: (a, b) => out(a) - out(b) || String(b.createdAt).localeCompare(String(a.createdAt)) || a.price - b.price,
  }[sort] || ((a, b) => a.price - b.price);
  return list.slice().sort(cmp);
}

export const results = (products, q, ctx) => sortProducts(pool(products, q).filter((p) => matches(p, q, ctx)), q.sort);

/** Facet list from the attribute schema: price buckets first, then filterable attributes in AttributeDef.order.
 *  Values follow the schema's display order; values that never occur in the catalog never render. */
export function buildFacets(products, defs, buckets = []) {
  const valuesOf = (key) => new Set(products.flatMap((p) => (p.attrs ? p.attrs[key] : p.attributes?.[key]) || []));
  const facets = [];
  if (buckets.length) facets.push({ key: 'price', label: 'Price', display: 'checkbox', values: buckets.filter((b) => products.some((p) => inRange(p.price, parseRange(b.id)))).map((b) => ({ value: b.id, label: b.label })) });
  for (const d of defs.filter((x) => x.filterable).sort((a, b) => a.order - b.order)) {
    const present = valuesOf(d.key);
    const ordered = [...(d.values || []).filter((v) => present.has(v)), ...[...present].filter((v) => !(d.values || []).includes(v)).sort()];
    if (ordered.length) facets.push({ key: d.key, label: d.label, display: d.display, explainer: d.explainer, values: ordered.map((v) => ({ value: v, label: v })) });
  }
  return facets;
}

/** Standard faceted counts: each facet's values are counted against every OTHER active filter. */
export function facetCounts(products, q, facets, ctx) {
  const base = pool(products, q);
  const counts = {};
  for (const f of [...facets, { key: 'category' }]) {
    const c = {};
    for (const p of base) {
      if (!matches(p, q, ctx, f.key)) continue;
      const vals = f.key === 'category' ? [p.categoryId] : f.key === 'price' ? f.values.filter((v) => inRange(p.price, parseRange(v.value))).map((v) => v.value) : (p.attrs ? p.attrs[f.key] : p.attributes?.[f.key]) || [];
      for (const v of vals) c[v] = (c[v] || 0) + 1;
    }
    counts[f.key] = c;
  }
  return counts;
}

/** A facet renders only if the current category's products have ≥2 distinct values for it. */
export function visibleFacetKeys(products, q, facets) {
  const scope = pool(products, q).filter((p) => !q.category || p.categoryId === q.category);
  return facets.filter((f) => {
    const seen = new Set();
    for (const p of scope) {
      const vals = f.key === 'price' ? f.values.filter((v) => inRange(p.price, parseRange(v.value))).map((v) => v.value) : (p.attrs ? p.attrs[f.key] : p.attributes?.[f.key]) || [];
      vals.forEach((v) => seen.add(v));
      if (seen.size >= 2) return true;
    }
    return false;
  }).map((f) => f.key);
}

/** Human summary of the active filters, for the WhatsApp "find it for me" message:
 *  "Lenovo, 16GB RAM, touchscreen, KSh 25K–35K". Wording comes from AttributeDef.summary / valueSummaries. */
export function filterSummary(q, { defs = [], buckets = [], categories = [] } = {}) {
  const parts = [];
  if (q.category) parts.push(categories.find((c) => c.id === q.category)?.name || q.category);
  for (const d of defs.slice().sort((a, b) => a.order - b.order)) {
    const vals = q.attrs[d.key];
    if (!vals?.length) continue;
    const words = vals.map((v) => d.valueSummaries?.[v] || (d.summary ? d.summary.replace('{value}', v) : v));
    parts.push(words.join(' or '));
  }
  if (q.price.length) parts.push(q.price.map((id) => rangeLabel(id, buckets)).join(' or '));
  if (q.q) parts.push(`"${q.q}"`);
  return parts.join(', ');
}
