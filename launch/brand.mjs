// Brand resolution for the launch flow (MVP spec §1 step 1): logo → colour sampled from the logo,
// Brand Kit → primary colour + vibe, Generic → Duka Bee house style. Everything goes through the same
// contrast-safety check as the demos before it reaches the composer.
import { safeColors } from '../pipeline/contrast.mjs';

// ---------- seeded randomness (also used by the shareable /store/?seed=… sample stores) ----------
const hash = (str) => { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; };
export const rng = (seed) => { let a = hash(String(seed)); return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const newSeed = () => Math.random().toString(36).slice(2, 8);

// ---------- colour helpers ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((s) => ((n >> s) & 255) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}
export function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [16, 8, 0].map((s) => ((n >> s) & 255) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');

/** Build a full token set from one brand colour. */
export function tokensFromPrimary(primary) {
  const { h, s } = hexToHsl(primary);
  const ink = hslToHex(h, clamp(s * 0.5, 0.1, 0.4), 0.11);
  return {
    paper: hslToHex(h, clamp(s * 0.35, 0.05, 0.3), 0.965),
    surface: '#ffffff',
    ink,
    muted: hslToHex(h, clamp(s * 0.15, 0.05, 0.15), 0.36),
    line: hslToHex(h, clamp(s * 0.3, 0.08, 0.25), 0.87),
    accent: primary,
    accentInk: ratio('#ffffff', primary) >= ratio(ink, primary) ? '#ffffff' : ink,
    soft: hslToHex(h, clamp(s * 0.5, 0.1, 0.45), 0.92),
    highlight: hslToHex((h + 40) % 360, 0.85, 0.6),
  };
}

/** Duka Bee house style: the default brand.md when the seller gives no logo and no kit. */
export const HOUSE = {
  name: 'Duka Bee house style',
  colors: { paper: '#faf7ef', surface: '#fffdf8', ink: '#16140f', muted: '#5f5a4f', line: '#e6dfcd', accent: '#16140f', accentInk: '#ffffff', soft: '#fff1b8', highlight: '#ffc905' },
  type: { display: 'Bricolage Grotesque', displayWeight: 700, body: 'DM Sans', tracking: '-0.03em', ph: 'montserrat' },
  shape: { radius: '14px', card: 'plain', button: 'pill', density: 'airy' },
  hero: 'hero-photo',
};

export const VIBES = {
  clean: { label: 'Clean', type: { display: 'DM Sans', displayWeight: 700, body: 'DM Sans', tracking: '-0.03em', ph: 'montserrat' }, shape: { radius: '10px', card: 'plain', button: 'solid', density: 'airy' }, hero: 'hero-photo' },
  bold: { label: 'Bold', type: { display: 'Archivo Black', displayWeight: 400, body: 'Archivo', tracking: '-0.03em', ph: 'oswald' }, shape: { radius: '0px', card: 'framed', button: 'solid', density: 'compact' }, hero: 'hero-photo-stat' },
  elegant: { label: 'Elegant', type: { display: 'Playfair Display', displayWeight: 600, body: 'DM Sans', tracking: '-0.02em', ph: 'playfair-display' }, shape: { radius: '0px', card: 'plain', button: 'solid', density: 'airy' }, hero: 'hero-photo' },
  playful: { label: 'Playful', type: { display: 'Fraunces', displayWeight: 600, body: 'Work Sans', tracking: '-0.03em', ph: 'lora' }, shape: { radius: '20px', card: 'soft', button: 'pill', density: 'airy' }, hero: 'hero-photo' },
};

// ---------- random looks: "Surprise me" and shareable sample stores ----------
export const PALETTES = [
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
export const TYPES = [
  { display: 'Playfair Display', displayWeight: 600, body: 'DM Sans', tracking: '-0.03em', ph: 'playfair-display' },
  { display: 'Space Grotesk', displayWeight: 700, body: 'Inter', tracking: '-0.05em', ph: 'montserrat' },
  { display: 'Cormorant Garamond', displayWeight: 600, body: 'Karla', tracking: '-0.01em', ph: 'playfair-display' },
  { display: 'Fraunces', displayWeight: 600, body: 'Work Sans', tracking: '-0.03em', ph: 'lora' },
  { display: 'Syne', displayWeight: 700, body: 'Manrope', tracking: '-0.04em', ph: 'poppins' },
  { display: 'Bricolage Grotesque', displayWeight: 700, body: 'DM Sans', tracking: '-0.04em', ph: 'raleway' },
  { display: 'Archivo Black', displayWeight: 400, body: 'Archivo', tracking: '-0.03em', ph: 'oswald' },
  { display: 'DM Serif Display', displayWeight: 400, body: 'Nunito Sans', tracking: '-0.01em', ph: 'lora' },
];
export const SHAPES = [
  { radius: '0px', card: 'plain', button: 'solid', density: 'airy' },
  { radius: '0px', card: 'framed', button: 'solid', density: 'compact' },
  { radius: '18px', card: 'soft', button: 'pill', density: 'airy' },
  { radius: '8px', card: 'framed', button: 'solid', density: 'compact' },
  { radius: '12px', card: 'plain', button: 'pill', density: 'airy' },
  { radius: '24px', card: 'soft', button: 'solid', density: 'compact' },
];
const HEROES = ['hero-photo', 'hero-photo-stat'];

/**
 * draft.brand → { colors, type, shape, hero, look, fixes }. Deterministic for a given draft.
 * modes: 'logo' (colour sampled from logo), 'kit' (primary + vibe), 'generic' (house style),
 *        'seed' (fully random look; used for shareable sample-store links)
 */
export function resolveBrand(brand, seed = 'duka') {
  const r = rng(`${seed}|look`);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const mode = brand.mode || 'generic';
  let colors, type, shape, hero, label;

  if (mode === 'seed') {
    const p = pick(PALETTES);
    colors = Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'name'));
    type = pick(TYPES); shape = pick(SHAPES); hero = pick(HEROES);
    label = `${p.name} · ${type.display}`;
  } else if (mode === 'generic') {
    colors = { ...HOUSE.colors }; type = HOUSE.type; shape = HOUSE.shape; hero = HOUSE.hero; label = HOUSE.name;
  } else {
    const primary = isHex(brand.primary) ? brand.primary : '#16140f';
    colors = tokensFromPrimary(primary);
    if (brand.vibe === 'surprise') { type = pick(TYPES); shape = pick(SHAPES); hero = pick(HEROES); label = `Surprise look · ${type.display}`; }
    else { const v = VIBES[brand.vibe] || VIBES.clean; type = v.type; shape = v.shape; hero = v.hero; label = `${v.label} style`; }
  }
  const safe = safeColors(colors);
  return { colors: safe.color, type, shape, hero, look: label, fixes: safe.fixes };
}
