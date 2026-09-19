// Launch flow → store. Turns a seller's draft (brand, details, catalog) into a vault and renders it with
// the same Kiwanda composer and runtime as the three demos. Runs in the browser and in Node.
import { composeSite } from '../kiwanda/pages.mjs';
import { resolveBrand, newSeed } from './brand.mjs';
import { NICHES, LEGACY_CAT } from './niches.mjs';

export const MAX_PRODUCTS = 5;
export const MIN_PRODUCTS = 3;

export const emptyDraft = () => ({
  v: 1,
  id: 'preview',
  seed: newSeed(),
  brand: { name: '', mode: 'generic', logo: null, primary: '#0f6b8f', vibe: 'clean', wordmark: '' },
  details: { description: '', phone: '', location: '', policy: [], policyNote: '' },
  catalog: { niche: null, attrLabel: 'Size', attrSelectable: false, dirty: false, products: [] },
});

export const productFromTemplate = (t, i = 0) => ({ id: `p${Date.now().toString(36)}${i}`, name: t.name, price: t.price, category: t.category, attr: t.attr, description: t.description, photo: null });
export const blankProduct = (i = 0) => ({ id: `p${Date.now().toString(36)}${i}`, name: '', price: '', category: '', attr: '', description: '', photo: null });

export function seedCatalog(draft, nicheId) {
  const n = NICHES[nicheId];
  draft.catalog = { niche: nicheId, attrLabel: n.attr.label, attrSelectable: n.attr.selectable, dirty: false, products: n.products.map(productFromTemplate) };
  return draft;
}

/** Legacy shareable sample stores: /store/?name=…&wa=…&cat=…&seed=…  (dummy niche + random look). */
export function draftFromQuery(params) {
  const get = (k) => (params.get(k) || '').trim();
  const nicheId = NICHES[get('cat')] ? get('cat') : LEGACY_CAT[get('cat')] || 'clothing';
  const draft = emptyDraft();
  draft.seed = get('seed') || 'duka';
  draft.id = `sample-${nicheId}-${draft.seed}`;
  draft.brand = { ...draft.brand, name: get('name').slice(0, 40) || 'My Duka', mode: 'seed' };
  draft.details.phone = get('wa').replace(/[^0-9]/g, '').replace(/^0/, '254').slice(0, 15) || '254700000000';
  seedCatalog(draft, nicheId);
  return draft;
}

const slug = (v) => v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const hex = (c) => c.replace('#', '');
const ph = (w, h, bg, fg, text, font) => `https://placehold.co/${w}x${h}/${hex(bg)}/${hex(fg)}?text=${encodeURIComponent(text).replace(/%20/g, '+')}&font=${font}`;
const A = (key, label, values, filterable, selectable) => ({ key, label, values: values.map((value) => ({ value })), filterable, selectable, evidence: 'seller draft', assumed: false });
export const normalisePhone = (v) => String(v || '').replace(/[^0-9]/g, '').replace(/^0/, '254').replace(/^7/, '2547').replace(/^1/, '2541').slice(0, 15);

/** Draft → { shop, products, look }. */
export function buildVault(draft) {
  const brand = resolveBrand(draft.brand, draft.seed);
  const niche = NICHES[draft.catalog.niche];
  const { colors: c, type, shape } = brand;
  const name = (draft.brand.name || 'My Duka').trim();

  const tints = [[c.soft, c.ink], [c.accent, c.accentInk], [c.surface, c.accent], [c.highlight, c.ink]];
  const seen = new Set();
  const products = draft.catalog.products
    .filter((p) => p.name && Number(p.price) > 0)
    .slice(0, MAX_PRODUCTS)
    .map((p, n) => {
      let s = slug(p.name); while (seen.has(s)) s += '-2'; seen.add(s);
      const values = String(p.attr || '').split(',').map((v) => v.trim()).filter(Boolean);
      const attrLabel = (draft.catalog.attrLabel || 'Option').trim() || 'Option';
      const attributes = [A('category', 'Category', [(p.category || 'General').trim() || 'General'], true, false)];
      if (values.length) attributes.push(A(slug(attrLabel).replace(/-/g, '_') || 'option', attrLabel, values, true, !!draft.catalog.attrSelectable && values.length > 1));
      const [bg, fg] = tints[n % tints.length];
      return {
        type: 'product', id: s, slug: s, name: p.name.trim(), sourceName: p.name.trim(), price: Math.round(Number(p.price)),
        image: p.photo || ph(800, 1000, bg, fg, p.name.trim(), type.ph),
        description: (p.description || '').trim() || `${p.name.trim()} from ${name}.`,
        attributes, provenance: { sourceSlugs: ['draft'], rawDescription: false },
      };
    });

  const uploaded = products.find((p) => p.image.startsWith('data:'));
  const description = (draft.details.description || '').trim() || niche?.body || `Order from ${name} on WhatsApp.`;
  const policyItems = [...(draft.details.policy || [])];
  const shop = {
    type: 'shop', id: draft.id || 'preview', name, wordmark: (draft.brand.wordmark || '').trim() || name,
    logo: draft.brand.mode === 'logo' ? draft.brand.logo : null,
    descriptor: niche?.label || 'Online store', tagline: niche?.hero || `Welcome to ${name}`, eyebrow: niche ? `${name} / ${niche.label.toLowerCase()}` : name,
    hero: { title: niche?.hero || `Welcome to ${name}`, body: description, variant: brand.hero, images: [uploaded ? uploaded.image : ph(1200, 1400, c.accent, c.accentInk, name, type.ph)] },
    footer: description,
    whatsapp: normalisePhone(draft.details.phone) || '254700000000',
    location: (draft.details.location || '').trim(),
    policy: policyItems.length || (draft.details.policyNote || '').trim() ? { items: policyItems, note: (draft.details.policyNote || '').trim() } : null,
    currency: 'KSh', featuredCount: Math.min(6, Math.max(4, products.length)),
    theme: { color: c, type: { display: type.display, displayWeight: type.displayWeight, body: type.body, tracking: type.tracking }, shape },
  };
  return { shop, products, look: { label: brand.look, fixes: brand.fixes, hero: brand.hero } };
}

// The composer writes links against a sentinel base; we route them to /store/?… query URLs.
const SENTINEL = '@@/';
export function storeUrl(linkParams, extra = {}, path = '/store/') {
  return `${path}?${new URLSearchParams({ ...linkParams, ...extra })}`;
}

export function renderStorePage(draft, { page = 'home', slug: productSlug, linkParams, assetBase = '/assets/', path = '/store/', demo = false } = {}) {
  const vault = buildVault(draft);
  if (!vault.products.length) throw new Error('This store has no products yet.');
  const site = composeSite(vault, { base: SENTINEL, productBase: SENTINEL, demo });
  const target = page === 'shop' ? site.pages.find((p) => p.kind === 'shop')
    : page === 'product' ? site.pages.find((p) => p.slug === productSlug) || site.pages.find((p) => p.kind === 'shop')
    : site.pages[0];
  const route = (rel) => {
    const [file, query = ''] = rel.split('?');
    const extra = Object.fromEntries(new URLSearchParams(query));
    if (file === 'index.html') return storeUrl(linkParams, {}, path);
    if (file === 'shop.html') return storeUrl(linkParams, { p: 'shop', ...extra }, path);
    const m = file.match(/^product\/(.+)\.html$/);
    if (m) return storeUrl(linkParams, { p: 'product', s: m[1] }, path);
    if (file.startsWith('assets/')) return assetBase + file.slice(7);
    return rel;
  };
  const html = target.html
    .replaceAll(`${SENTINEL}https://`, 'https://')
    .replaceAll(`${SENTINEL}data:`, 'data:')
    .replace(/(href|src)="@@\/([^"]*)"/g, (_, attr, rel) => `${attr}="${route(rel.replace(/&amp;/g, '&')).replace(/&/g, '&amp;')}"`)
    .replace(`data-base="${SENTINEL}"`, 'data-base=""');
  return { html, vault };
}
