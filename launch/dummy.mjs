// Launch flow — dummy-data intake. Runs in the browser (and Node): seller gives a store name + WhatsApp,
// picks a canned catalog, and a seed picks the look. Same vault shape and same Kiwanda composer as the
// three demos; the brand tokens go through the same contrast-safety check.
import { composeSite } from '../kiwanda/pages.mjs';
import { safeColors } from '../pipeline/contrast.mjs';

// ---------- seeded randomness ----------
const hash = (str) => { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; };
const rng = (seed) => { let a = hash(String(seed)); return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const newSeed = () => Math.random().toString(36).slice(2, 8);

// ---------- looks ----------
const PALETTES = [
  { name: 'Savanna', paper: '#f6efe4', surface: '#fffaf2', ink: '#2b2118', muted: '#6e6152', line: '#e3d6c3', accent: '#a8481f', accentInk: '#ffffff', soft: '#ecdcc4', highlight: '#f2b544' },
  { name: 'Ocean', paper: '#f1f5f7', surface: '#ffffff', ink: '#0f2a3a', muted: '#52636e', line: '#d6e1e7', accent: '#0f6b8f', accentInk: '#ffffff', soft: '#dcebf1', highlight: '#ffd166' },
  { name: 'Forest', paper: '#f3f4ee', surface: '#ffffff', ink: '#1f2d24', muted: '#5d685f', line: '#d9ddd0', accent: '#2f6b45', accentInk: '#ffffff', soft: '#dfe8d7', highlight: '#e9c46a' },
  { name: 'Blush', paper: '#fdf4f2', surface: '#fffaf9', ink: '#3d2129', muted: '#7c6068', line: '#f0d9d9', accent: '#b03a5b', accentInk: '#ffffff', soft: '#f6e0e2', highlight: '#f4a7b9' },
  { name: 'Night', paper: '#14161a', surface: '#1d2026', ink: '#f2efe8', muted: '#a9a59b', line: '#2f333b', accent: '#f5c542', accentInk: '#14161a', soft: '#262a31', highlight: '#f5c542' },
  { name: 'Citrus', paper: '#fffbea', surface: '#ffffff', ink: '#1d1a10', muted: '#6b6450', line: '#ece3c2', accent: '#e0671b', accentInk: '#ffffff', soft: '#fbefc4', highlight: '#7bd3a0' },
  { name: 'Lilac', paper: '#f6f3fb', surface: '#ffffff', ink: '#261d3a', muted: '#665c78', line: '#e1dbee', accent: '#6b4fbb', accentInk: '#ffffff', soft: '#e8e1f7', highlight: '#ffcf5c' },
  { name: 'Mono', paper: '#f4f4f2', surface: '#ffffff', ink: '#111111', muted: '#5f5f5f', line: '#dcdcdc', accent: '#111111', accentInk: '#ffffff', soft: '#e6e6e3', highlight: '#ffe14d' },
  { name: 'Terracotta', paper: '#fbf3ec', surface: '#fffaf6', ink: '#3a1f14', muted: '#7a6154', line: '#eed9ca', accent: '#c4623a', accentInk: '#ffffff', soft: '#f3dccb', highlight: '#2d6a5a' },
  { name: 'Midnight Blue', paper: '#0f1729', surface: '#16203a', ink: '#eef2fb', muted: '#9ea9c2', line: '#26314d', accent: '#7cc4ff', accentInk: '#0f1729', soft: '#1c2743', highlight: '#ff9f6b' },
];
const TYPE = [
  { display: 'Playfair Display', displayWeight: 600, body: 'DM Sans', tracking: '-0.03em', ph: 'playfair-display' },
  { display: 'Space Grotesk', displayWeight: 700, body: 'Inter', tracking: '-0.05em', ph: 'montserrat' },
  { display: 'Cormorant Garamond', displayWeight: 600, body: 'Karla', tracking: '-0.01em', ph: 'playfair-display' },
  { display: 'Fraunces', displayWeight: 600, body: 'Work Sans', tracking: '-0.03em', ph: 'lora' },
  { display: 'Syne', displayWeight: 700, body: 'Manrope', tracking: '-0.04em', ph: 'poppins' },
  { display: 'Bricolage Grotesque', displayWeight: 700, body: 'DM Sans', tracking: '-0.04em', ph: 'raleway' },
  { display: 'Archivo Black', displayWeight: 400, body: 'Archivo', tracking: '-0.03em', ph: 'oswald' },
  { display: 'DM Serif Display', displayWeight: 400, body: 'Nunito Sans', tracking: '-0.01em', ph: 'lora' },
];
const SHAPES = [
  { radius: '0px', card: 'plain', button: 'solid', density: 'airy' },
  { radius: '0px', card: 'framed', button: 'solid', density: 'compact' },
  { radius: '18px', card: 'soft', button: 'pill', density: 'airy' },
  { radius: '8px', card: 'framed', button: 'solid', density: 'compact' },
  { radius: '12px', card: 'plain', button: 'pill', density: 'airy' },
  { radius: '24px', card: 'soft', button: 'solid', density: 'compact' },
];
const HEROES = ['hero-photo', 'hero-photo-stat'];

// ---------- canned catalogs (same attribute schema as the demos) ----------
const A = (key, values, f = false, s = false, label) => ({ key, label: label || key[0].toUpperCase() + key.slice(1), values: [].concat(values).map((v) => ({ value: v })), filterable: f, selectable: s, evidence: 'dummy catalog', assumed: false });
const TOPS = ['S', 'M', 'L', 'XL'];

export const CATALOGS = {
  fashion: {
    label: 'Fashion & clothing',
    hero: ['Everyday style, delivered.', 'Fresh fits for every day.', 'Wear it your way.'],
    body: 'Shirts, dresses, denim and layers, picked for how you actually live. Order in a tap on WhatsApp.',
    products: [
      ['Linen Button-Down Shirt', 2400, 'Shirts', [A('size', TOPS, true, true), A('colour', ['White', 'Sky blue', 'Sand'], true, true), A('material', '100% linen')]],
      ['Classic Denim Jacket', 4200, 'Jackets', [A('size', TOPS, true, true), A('colour', 'Indigo', true), A('material', 'Cotton denim')]],
      ['Ankara Wrap Dress', 3800, 'Dresses', [A('size', ['XS', 'S', 'M', 'L'], true, true), A('colour', 'Multi', true), A('fit', 'Wrap, midi length')]],
      ['Slim Fit Chinos', 2900, 'Trousers', [A('size', ['30', '32', '34', '36'], true, true, 'Waist'), A('colour', ['Khaki', 'Navy', 'Olive'], true, true)]],
      ['Oversized Cotton Tee', 1200, 'T-Shirts', [A('size', TOPS, true, true), A('colour', ['Black', 'White'], true, true), A('material', 'Heavyweight cotton')]],
      ['Knit Pullover Hoodie', 3500, 'Jackets', [A('size', TOPS, true, true), A('colour', 'Charcoal', true)]],
      ['Pleated Midi Skirt', 2700, 'Dresses', [A('size', ['S', 'M', 'L'], true, true), A('colour', 'Emerald', true)]],
      ['Canvas Tote Bag', 1500, 'Accessories', [A('colour', 'Natural', true), A('size', '40 × 35 cm')]],
    ],
  },
  kitchen: {
    label: 'Kitchen & home',
    hero: ['Cook more, stress less.', 'Tools for the meals you make.', 'A kitchen that works as hard as you.'],
    body: 'Cookware, appliances and everyday helpers for busy homes. Order on WhatsApp, delivered to your door.',
    products: [
      ['Non-Stick Frying Pan 28cm', 2200, 'Cookware', [A('material', 'Aluminium', true), A('diameter', '28 cm')]],
      ['Electric Kettle 1.7L', 2600, 'Appliances', [A('material', 'Stainless steel', true), A('capacity', '1.7 L'), A('power', '2000 W')]],
      ['Stainless Steel Sufuria Set', 3400, 'Cookware', [A('material', 'Stainless steel', true), A('pieces', '5')]],
      ['4-Slice Toaster', 3100, 'Appliances', [A('material', 'Plastic', true), A('colour', ['White', 'Black'], false, true)]],
      ['Bamboo Chopping Board', 950, 'Utensils', [A('material', 'Bamboo', true), A('size', '40 × 28 cm')]],
      ['Glass Storage Jars (Set of 3)', 1800, 'Storage', [A('material', 'Glass', true), A('capacity', '3 × 1 L')]],
      ['Hand Blender 600W', 2800, 'Appliances', [A('material', 'Stainless steel', true), A('power', '600 W')]],
      ['Silicone Spatula Set', 850, 'Utensils', [A('material', 'Silicone', true), A('pieces', '4')]],
    ],
  },
  beauty: {
    label: 'Beauty & care',
    hero: ['Small rituals. Big glow.', 'Care that fits your routine.', 'Beauty, simplified.'],
    body: 'Skincare, makeup and body care for everyday routines. Ask anything on WhatsApp.',
    products: [
      ['Hydrating Face Serum', 1900, 'Skincare', [A('brand', 'Glow Lab', true), A('volume', '30 ml')]],
      ['Matte Lipstick', 850, 'Makeup', [A('brand', 'Velvet', true), A('shade', ['Rose', 'Berry', 'Nude', 'Red'], false, true)]],
      ['Shea Body Butter', 1200, 'Bodycare', [A('brand', 'Karite', true), A('size', '200 g', false, false)]],
      ['SPF 50 Sunscreen', 1650, 'Skincare', [A('brand', 'Glow Lab', true), A('volume', '50 ml')]],
      ['Volume Mascara', 1100, 'Makeup', [A('brand', 'Velvet', true), A('shade', 'Black')]],
      ['Argan Hair Oil', 1450, 'Haircare', [A('brand', 'Karite', true), A('volume', '100 ml')]],
      ['Gentle Foaming Cleanser', 980, 'Skincare', [A('brand', 'Pure', true), A('volume', '150 ml')]],
      ['Nail Polish', 450, 'Makeup', [A('brand', 'Velvet', true), A('shade', ['Coral', 'Plum', 'Clear'], false, true)]],
    ],
  },
};

const slug = (v) => v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hex = (c) => c.replace('#', '');
const ph = (w, h, bg, fg, text, font) => `https://placehold.co/${w}x${h}/${hex(bg)}/${hex(fg)}?text=${encodeURIComponent(text).replace(/%20/g, '+')}&font=${font}`;

/** Normalise launch input. Only name + WhatsApp are seller-provided; everything else is dummy data. */
export function readConfig(params) {
  const get = (k) => (params.get(k) || '').trim();
  const cat = CATALOGS[get('cat')] ? get('cat') : 'fashion';
  return {
    name: get('name').slice(0, 40) || 'My Duka',
    wa: get('wa').replace(/[^0-9]/g, '').replace(/^0/, '254').slice(0, 15) || '254700000000',
    cat,
    seed: get('seed') || 'duka',
  };
}

/** Build the vault (shop + products) for a config. Deterministic for a given seed. */
export function buildVault(cfg) {
  const r = rng(`${cfg.seed}|${cfg.cat}`);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const palette = pick(PALETTES);
  const type = pick(TYPE);
  const shape = pick(SHAPES);
  const heroVariant = pick(HEROES);
  const { color, fixes } = safeColors(Object.fromEntries(Object.entries(palette).filter(([k]) => k !== 'name')));
  const catalog = CATALOGS[cfg.cat];
  const order = catalog.products.map((p, i) => [r(), i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  // Product imagery: placeholders tinted to the store's own palette, so each generation looks different.
  const tints = [[color.soft, color.ink], [color.accent, color.accentInk], [color.surface, color.accent], [color.highlight, color.ink]];
  const products = order.map((i, n) => {
    const [name, price, category, attrs] = catalog.products[i];
    const [bg, fg] = tints[n % tints.length];
    return {
      type: 'product', id: slug(name), slug: slug(name), name, sourceName: name, price,
      image: ph(800, 1000, bg, fg, name, type.ph),
      description: `${name} from ${cfg.name}. This is sample catalog content for a Duka Bee demo store — swap in your own photos, prices and descriptions when you launch.`,
      attributes: [A('category', category, true), ...attrs],
      provenance: { sourceSlugs: ['dummy'], rawDescription: false },
    };
  });
  const shop = {
    type: 'shop', id: `${slug(cfg.name) || 'duka'}-${cfg.seed}`, name: cfg.name, wordmark: cfg.name.toUpperCase().length <= 14 ? cfg.name.toUpperCase() : cfg.name,
    descriptor: catalog.label, tagline: pick(catalog.hero), eyebrow: `${cfg.name} / ${catalog.label.toLowerCase()}`,
    hero: { title: pick(catalog.hero), body: catalog.body, variant: heroVariant, images: [ph(1200, 1400, color.accent, color.accentInk, cfg.name, type.ph)] },
    footer: `${cfg.name} — order on WhatsApp and we'll confirm price, delivery and payment with you directly.`,
    whatsapp: cfg.wa, currency: 'KSh', featuredCount: 4 + Math.floor(r() * 3),
    theme: { color, type: { display: type.display, displayWeight: type.displayWeight, body: type.body, tracking: type.tracking }, shape },
  };
  return { shop, products, look: { palette: palette.name, font: type.display, shape: `${shape.card} cards, ${shape.button} buttons`, hero: heroVariant, fixes } };
}

// Store pages live at /store/?name=…&wa=…&cat=…&seed=…&p=home|shop|product&s=<slug>. The composer
// writes links against a sentinel base, then we route them to query URLs.
const SENTINEL = '@@/';
export function storeUrl(cfg, extra = {}, path = '/store/') {
  const q = new URLSearchParams({ name: cfg.name, wa: cfg.wa, cat: cfg.cat, seed: cfg.seed, ...extra });
  return `${path}?${q}`;
}

export function renderStorePage(cfg, { page = 'home', slug: productSlug, assetBase = '/assets/', path = '/store/' } = {}) {
  const vault = buildVault(cfg);
  const site = composeSite(vault, { base: SENTINEL, productBase: SENTINEL });
  const target = page === 'shop' ? site.pages.find((p) => p.kind === 'shop')
    : page === 'product' ? site.pages.find((p) => p.slug === productSlug) || site.pages.find((p) => p.kind === 'shop')
    : site.pages[0];
  const route = (rel) => {
    const [file, query = ''] = rel.split('?');
    const extra = Object.fromEntries(new URLSearchParams(query));
    if (file === 'index.html') return storeUrl(cfg, {}, path);
    if (file === 'shop.html') return storeUrl(cfg, { p: 'shop', ...extra }, path);
    const m = file.match(/^product\/(.+)\.html$/);
    if (m) return storeUrl(cfg, { p: 'product', s: m[1] }, path);
    if (file.startsWith('assets/')) return assetBase + file.slice(7);
    return rel;
  };
  const html = target.html
    .replaceAll(`${SENTINEL}https://`, 'https://')
    .replace(/(href|src)="@@\/([^"]*)"/g, (_, attr, rel) => `${attr}="${route(rel.replace(/&amp;/g, '&')).replace(/&/g, '&amp;')}"`)
    .replace(`data-base="${SENTINEL}"`, 'data-base=""');
  return { html, vault };
}
