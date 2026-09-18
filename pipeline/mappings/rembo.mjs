// Rembo (cosmetics) — brand + vault mapping decisions, verified against sources/rembo/source.json.
import { attr } from './helpers.mjs';

export const brand = {
  tagline: 'Small rituals. Big difference.',
  voice: 'Calm, warm, editorial. Talk about the routine, not the chemistry.',
  tokenSource: 'defined — taken from the existing Rembo storefront CSS (demo-stores.css .store--rembo); no logo asset exists to sample',
  tokens: {
    paper: '#fff7f3', surface: '#fffdfb', ink: '#4a2a31', muted: '#82696d', line: '#ead0d0',
    accent: '#a64d65', accentInk: '#fffdfb', soft: '#f2dedf', highlight: '#e9a7b6',
  },
  type: { display: 'Cormorant Garamond', displayWeight: 600, body: 'DM Sans', headingCase: 'none', tracking: '-0.02em' },
  shape: { radius: '22px', cardStyle: 'soft', buttonStyle: 'pill', density: 'airy' },
  hero: { variant: 'hero-photo', imageFrom: 'heroImages' },
  featuredCount: 5,
};

const cat = (v) => attr('category', v, { filterable: true, evidence: 'Curated catalog category' });
const brandAttr = (v) => attr('brand', v, { filterable: true, evidence: 'Leading brand name in product title' });
const vol = (v, evidence = 'Name') => attr('volume', v, { evidence });
const shade = (v, evidence = 'Name') => attr('shade', v, { evidence });
const d = (key, v, evidence) => attr(key, v, { evidence });

export const products = [
  { match: 'l-ore-al-men-expert', slug: 'loreal-men-power-age-serum', title: "L'Oréal Men Expert Power Age Serum", attributes: [cat('Skincare'), brandAttr("L'Oréal"), vol('30 ml'), d('key ingredient', 'Hyaluronic acid', 'Name')] },
  { match: 'garnier-pure-active', slug: 'garnier-anti-blackhead-3-in-1', title: 'Garnier Pure Active 3-in-1 Anti-Blackhead', attributes: [cat('Skincare'), brandAttr('Garnier'), vol('50 ml'), d('skin type', 'Oily, acne-prone', 'Curated description')] },
  { match: 'nivea-men-deep', slug: 'nivea-men-deep-roll-on', title: 'NIVEA MEN Deep Anti-Perspirant Roll-On (2-pack)', attributes: [cat('Bodycare'), brandAttr('NIVEA'), vol('2 × 50 ml'), d('protection', '72 h', 'Name')] },
  { match: 'advanced-korean-skin', slug: 'active-fair-body-oil', title: 'Active Fair Body Oil, Glutathione + Turmeric', attributes: [cat('Skincare'), brandAttr('Advanced Korean Skin'), vol('280 ml')] },
  { match: 'nivea-uv-sunscreen', slug: 'nivea-uv-face-spf50', title: 'NIVEA UV Face Shine Control SPF 50 (2-pack)', attributes: [cat('Skincare'), brandAttr('NIVEA'), vol('2 × 40 ml'), d('SPF', '50', 'Name')] },
  { match: 'maybelline-colossal-bubble', slug: 'maybelline-colossal-bubble-mascara', title: 'Maybelline Colossal Bubble Mascara', attributes: [cat('Makeup'), brandAttr('Maybelline'), shade('Blackest Black')] },
  { match: 'bellazuri-matte-setting', slug: 'bellazuri-matte-setting-spray', title: 'BELLAZURI Matte Setting Spray', attributes: [cat('Makeup'), brandAttr('BELLAZURI'), vol('50 ml'), d('finish', 'Matte', 'Name')] },
  { match: 'ruby-kisses-bare-blusher', slug: 'ruby-kisses-bare-blusher', title: 'Ruby Kisses Bare Blusher', attributes: [cat('Makeup'), brandAttr('Ruby Kisses'), shade('Partying Bare')] },
  { match: 'bellazuri-10-color', slug: 'bellazuri-10-shade-palette', title: 'BELLAZURI 10-Shade Eyeshadow Palette', attributes: [cat('Makeup'), brandAttr('BELLAZURI'), d('shades', '10 in one palette', 'Name — a palette, not a choice')] },
  { match: 'm-a-c-retro-matte', slug: 'mac-retro-matte-high-drama', title: 'M·A·C Retro Matte Liquid Lipcolour', attributes: [cat('Makeup'), brandAttr('M·A·C'), shade('High Drama'), vol('5 ml'), d('finish', 'Matte', 'Name')] },
  { match: 'maybelline-hydrating-lifter', slug: 'maybelline-lifter-gloss-taffy', title: 'Maybelline Lifter Gloss', attributes: [cat('Makeup'), brandAttr('Maybelline'), shade('Taffy')] },
  { match: 'maybelline-fit-me', slug: 'maybelline-fit-me-foundation', title: 'Maybelline Fit Me Matte + Poreless Foundation', attributes: [cat('Makeup'), brandAttr('Maybelline'), shade('356 Warm Coconut'), d('finish', 'Matte', 'Name')] },
  { match: 'generic-matte-lipstick', slug: 'princess-matte-lipstick', title: 'Princess Series Matte Lipstick', attributes: [
    cat('Makeup'), brandAttr('Generic'),
    attr('shade', ['Shade 1', 'Shade 2', 'Shade 3', 'Shade 4'], { selectable: true, assumed: true, evidence: 'Name: "4 Colors Available" — shade names not supplied; placeholders pending seller' }),
    d('finish', 'Matte', 'Name'),
  ] },
  { match: 'generic-6-piece-lip-gloss', slug: 'lip-gloss-gift-set-6', title: 'Mirror Lip Gloss Gift Set (6 pieces)', attributes: [cat('Makeup'), brandAttr('Generic'), d('pieces', '6', 'Name')] },
  { match: 'generic-nail-art-kit', slug: 'nail-art-kit', title: 'Nail Art Extension Kit', attributes: [cat('Makeup'), brandAttr('Generic'), d('style', 'Style 1', 'Name — implies other styles exist (logged)')] },
  { match: 'anashe-nail-polish', slug: 'anashe-nail-polish-21', title: 'Anashe Nail Polish', attributes: [cat('Makeup'), brandAttr('Anashe'), shade('21')] },
  { match: 'generic-barber-stainless', slug: 'straight-edge-razor', title: 'Barber Straight-Edge Razor', attributes: [cat('Haircare'), brandAttr('Generic'), d('material', 'Stainless steel', 'Name')] },
  { match: 'generic-double-head-electric', slug: 'double-head-shaving-kit', title: 'Double-Head Electric Shaving Kit', attributes: [cat('Haircare'), brandAttr('Generic')] },
  { match: 'mekis-beard-growth', slug: 'mekis-beard-growth-kit', title: 'Mekis Beard Growth & Soothing Kit', attributes: [cat('Haircare'), brandAttr('Mekis')] },
  { match: 'generic-digital-display-electric-nose', slug: 'nose-hair-trimmer', title: 'Digital Display Nose Hair Trimmer', attributes: [cat('Haircare'), brandAttr('Generic'), d('power', 'Rechargeable', 'Curated description')] },
  { match: 'disaar-hair-removal', slug: 'disaar-hair-removal-foam', title: 'Disaar Hair Removal Spray Foam', attributes: [cat('Haircare'), brandAttr('Disaar')] },
];

export const findings = [
  { severity: 'decision', text: 'Shade is not filterable: 7 products carry a shade and every shade value is unique, so the facet would be all singletons. Brand is used as the second facet instead (Maybelline, NIVEA, BELLAZURI each have several products).' },
  { severity: 'decision', text: 'Volume is descriptive only: every product is sold in one size, so volume is neither filterable nor selectable. The spec\'s illustrative mapping assumed multi-size products; this catalog has none.' },
  { severity: 'gap', text: 'The only true shade choice is the Princess matte lipstick ("4 Colors Available"), but the source never names the shades. The vault uses placeholders "Shade 1–4" flagged `assumed`; the seller must supply names before launch.' },
  { severity: 'gap', text: '"Nail Art Kit — Style 1" implies other styles exist. Only Style 1 is listed, so it stays descriptive.' },
  { severity: 'note', text: 'The Taskbee comment says 20 Rembo products; the curated list actually has 21. All 21 are in the vault.' },
];
