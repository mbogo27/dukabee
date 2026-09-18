// Jikoni (kitchen) — brand + vault mapping decisions, verified against sources/jikoni/source.json.
// No source product comes in more than one variant, so nothing here is selectable: Add to Cart is
// enabled immediately on every product page. That's the schema generalising, not a special case.
import { attr } from './helpers.mjs';

export const brand = {
  tagline: 'Tools for the meals you make.',
  voice: 'Useful, plain-spoken, a little warm. Lead with what the tool does and its capacity.',
  tokenSource: 'defined — taken from the existing Jikoni storefront CSS (demo-stores.css .store--jikoni); accent darkened #c36a36 → #b25a2a (button text was 3.80:1), muted #69736a → #5f6a61 (was 4.34:1); no logo asset exists to sample',
  tokens: {
    paper: '#f6f0e5', surface: '#fffdf7', ink: '#283b31', muted: '#5f6a61', line: '#d6cdbd',
    accent: '#b25a2a', accentInk: '#fffdf7', soft: '#dce4d4', highlight: '#e0ac4a',
  },
  type: { display: 'Space Grotesk', displayWeight: 700, body: 'DM Sans', headingCase: 'none', tracking: '-0.06em' },
  shape: { radius: '0px', cardStyle: 'framed', buttonStyle: 'solid', density: 'compact' },
  hero: { variant: 'hero-photo-stat', imageFrom: 'heroImages' },
  featuredCount: 6,
};

const cat = (v) => attr('category', v, { filterable: true, evidence: 'Curated catalog category' });
const material = (v, evidence) => attr('material', v, { filterable: true, evidence });
const capacity = (v, evidence) => attr('capacity', v, { evidence });
const d = (key, v, evidence) => attr(key, v, { evidence });

export const products = [
  { match: 'em-air-fryer', slug: 'em-air-fryer-5l', title: 'Em Air Fryer 5L, 1400W', attributes: [
    cat('Appliances'), material('Non-stick coating', 'Raw: "Inner liner material: Non-stick pot coating"'), capacity('5 L', 'Raw: "Capacity: 5L"'),
    d('power', '1400 W', 'Name'), d('colour', 'Black and silver', 'Raw: "Colour: Black and silver"'), d('warranty', '1 year', 'Name: "1YR WRTY"'),
  ] },
  { match: 'cloudoon-mini-handheld', slug: 'handheld-milk-frother', title: 'Cloudoon Handheld Milk Frother, 3-Speed', attributes: [
    cat('Appliances'), material(['ABS plastic', 'Stainless steel'], 'Raw: "Material: ABS + 304 Stainless Steel"'),
    d('speeds', '3', 'Name'), d('length', '16 cm', 'Name'), d('colour', 'Green', 'Name'),
  ] },
  { match: 'portable-dual-cup-usb-juicer', slug: 'usb-dual-cup-juicer', title: 'Portable Dual-Cup USB Juicer', attributes: [
    cat('Appliances'), d('power', 'USB rechargeable', 'Curated description'), d('colour', 'White', 'Name'),
  ] },
  { match: 'digital-food-scale', slug: 'digital-kitchen-scale', title: 'Digital Kitchen Scale 10kg / 1g', attributes: [
    cat('Utensils'), material('ABS plastic', 'Name: "Waterproof ABS Design"'), capacity('10 kg max, 1 g precision', 'Name'),
  ] },
  { match: 'ailyons', slug: 'ailyons-blender-grinder', title: 'AILYONS 2-in-1 Blender & Grinder 1.6L', attributes: [
    cat('Appliances'), capacity('1.6 L', 'Name'), d('power', '350 W', 'Name'), d('blades', 'Stainless steel', 'Name'),
  ] },
  { match: 'wooden-handled-stainless', slug: 'wooden-handle-peeler', title: 'Wooden-Handle Peeler with Bottle Opener', attributes: [
    cat('Utensils'), material(['Stainless steel', 'Wood'], 'Name'),
  ] },
  { match: 'kitcha-cast-iron-skillet', slug: 'cast-iron-skillet-set', title: 'KITCHA Cast Iron Skillet Set (3 pieces)', attributes: [
    cat('Cookware'), material('Cast iron', 'Name'), d('sizes in set', '16 cm, 20 cm, 26 cm', 'Name — a set, not a choice'), d('pieces', '3', 'Name'),
  ] },
  { match: 'kitcha-19-piece-silicone', slug: 'silicone-utensil-set-19', title: 'KITCHA 19-Piece Silicone Utensil Set', attributes: [
    cat('Utensils'), material(['Silicone', 'Stainless steel'], 'Curated: food-grade silicone tools + knives/scissors'), d('pieces', '19', 'Name'),
  ] },
  { match: 'nunix-aluminium-pressure-cooker', slug: 'nunix-pressure-cooker-5l', title: 'Nunix Aluminium Pressure Cooker 5L', attributes: [
    cat('Appliances'), material('Aluminium', 'Name'), capacity('5 L', 'Name + raw "Capacity: 5L"'), d('colour', 'Silver', 'Name'),
  ] },
  { match: 'egg-boiler-7eggs', slug: 'electric-egg-boiler', title: 'Electric Egg Boiler & Poacher (7 eggs)', attributes: [
    cat('Appliances'), material('Stainless steel', 'Raw: "Stainless steel flat heating plate"'), capacity('7 eggs', 'Raw: "Capacity: 7 Eggs"'),
  ] },
  { match: '10-piece-kitchenware-set', slug: 'gold-cookware-set-10', title: '10-Piece Stainless Steel Cookware Set — Gold', attributes: [
    cat('Cookware'), material('Stainless steel', 'Raw: "Material: Stainless Steel"'), d('pieces', '10', 'Name'),
    d('sizes in set', '16–24 cm', 'Curated description'), d('colour', 'Gold', 'Name'),
  ] },
  { match: 'cyfaza-2-tier-dish-rack', slug: 'two-tier-dish-rack', title: 'CYFAZA 2-Tier Dish Rack with Drip Tray', attributes: [
    cat('Storage'), material('Stainless steel', 'Curated description'), capacity('Up to 35 plates', 'Raw: "holds up to 35 plates"'),
  ] },
  { match: 'stainless-steel-sieve-set', slug: 'stainless-sieve-set', title: 'Stainless Steel Sieve Set (3 sizes)', attributes: [
    cat('Cookware'), material('Stainless steel', 'Name'), d('sizes in set', '16.5–22.5 cm', 'Name — a set, not a choice'), d('pieces', '3', 'Name'),
  ] },
  { match: 'oraimo-thermogo', slug: 'oraimo-thermogo-750ml', title: 'Oraimo ThermoGo Insulated Thermos 750ml', attributes: [
    cat('Storage'), material('Stainless steel', 'Name'), capacity('750 ml', 'Raw: "Capacity: 750ml"'),
  ] },
  { match: '15l-lunch-bag', slug: 'insulated-cooler-bag-15l', title: 'Insulated Cooler Lunch Bag 15L', attributes: [
    cat('Storage'), material('Fabric', 'Raw: "Material: Oxford + EPE Foam + PEVA"'), capacity('15 L', 'Raw: "Capacity: 15 L"'), d('colour', 'Black', 'Raw: "Color: Black"'),
  ] },
];

export const findings = [
  { severity: 'decision', text: 'Capacity is kept descriptive, not filterable: the values span L, ml, kg, eggs and plates, so a capacity facet would be 13 singleton options. The composition spec\'s "likely filterable" guess doesn\'t hold for this catalog.' },
  { severity: 'decision', text: 'No product is sold in more than one variant, so no attribute is selectable. Sets (skillets, sieves, cookware) list their sizes as descriptive "sizes in set", not as a choice.' },
  { severity: 'gap', text: 'Two products (USB juicer, AILYONS blender) have no stated body material, so they don\'t appear under any material filter.' },
  { severity: 'gap', text: 'The AILYONS blender has no raw-scrape match (its raw name differs: "AILYONS AILYONS 16L"), so its attributes come from the curated name only.' },
];
