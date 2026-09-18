// Kladi (clothes) — brand + vault mapping decisions, verified against sources/kladi/source.json
// (curated names/descriptions) and the raw scrape descriptions it carries.
import { attr, TOP_SIZES, WAIST_SIZES } from './helpers.mjs';

export const brand = {
  tagline: 'Everyday menswear, priced for real life.',
  eyebrow: 'Kladi / menswear edit', // source eyebrow was "Luku / product edit" (the Taskbee page borrowed Luku's name)
  voice: 'Direct, confident, practical. Short sentences. Prices in KSh up front.',
  tokenSource: 'defined — taken from the existing Kladi/Luku storefront CSS (atelier.css, luku.css); muted darkened #78736c → #6f6a63 (was 4.32:1); no logo asset exists to sample',
  tokens: {
    paper: '#f7f5f1', surface: '#ffffff', ink: '#171614', muted: '#6f6a63', line: '#dedad3',
    accent: '#173b55', accentInk: '#f7f5f1', soft: '#ece3d5', highlight: '#ffcc05',
  },
  type: { display: 'Playfair Display', displayWeight: 500, body: 'DM Sans', headingCase: 'none', tracking: '-0.04em' },
  shape: { radius: '0px', cardStyle: 'plain', buttonStyle: 'solid', density: 'airy' },
  hero: { variant: 'hero-photo', imageFrom: 'featured' },
  featuredCount: 4,
};

// Per-product mapping. `match` is a slug prefix from the source snapshot.
const colour = (v, evidence) => attr('colour', v, { filterable: true, evidence });
const tops = (evidence = 'No size run in source; vertical default applied (tops S–XXL)') =>
  attr('size', TOP_SIZES, { filterable: true, selectable: true, assumed: evidence.startsWith('No size'), evidence });
const waist = (values, evidence) => attr('size', values, { filterable: true, selectable: true, label: 'Waist', evidence, assumed: evidence.startsWith('No') });
const cat = (v) => attr('category', v, { filterable: true, evidence: 'Curated catalog category' });

export const products = [
  { match: 'men-s-slim-fit-black-denim', slug: 'slim-fit-black-jeans', title: 'Slim Fit Black Denim Jeans + Free Belt', attributes: [
    cat('Jeans'), waist(['30', '32', '34', '36'], 'Name: "Sizes 30-36"'),
    colour('Black', 'Name says Black (raw spec says "Color: Grey" — conflict logged)'),
    attr('extras', 'Free belt included', { evidence: 'Name: "+FREE BELT"' }),
  ] },
  { match: 'men-s-slim-fit-denim-jeans-sky', slug: 'slim-fit-sky-blue-jeans', title: 'Slim Fit Denim Jeans — Sky Blue', attributes: [
    cat('Jeans'), waist(['30', '32', '34', '36', '38', '40'], 'Name: "Sizes 30-40"'),
    colour('Sky blue', 'Name + raw "Color - sky blue"'), attr('material', 'Non-fade denim', { evidence: 'Raw: "Non fade"' }),
  ] },
  { match: 'men-s-color-blocked-hooded', slug: 'colour-block-hoodie-khaki', title: 'Colour-Block Hooded Sweatshirt — Khaki', attributes: [
    cat('Hoodies & Jackets'), tops(), colour('Khaki', 'Name: "(khaki)"'), attr('material', 'Cotton', { evidence: 'Raw: "Main fabric composition: Cotton"' }),
  ] },
  { match: 'men-s-casual-straight-thick', slug: 'straight-denim-ash-grey', title: 'Straight Thick Denim Jeans — Ash Grey', attributes: [
    cat('Jeans'), waist(WAIST_SIZES, 'No waist sizes in source; vertical default applied (30–36)'),
    colour('Grey', 'Name: "Ash Gray"'), attr('material', '72.7% cotton, 23.6% polyester, 3.7% viscose', { evidence: 'Raw fabric composition' }),
  ] },
  { match: 'fashion-side-pocket-jeans', slug: 'side-pocket-jeans', title: 'Side Pocket Stretch Jeans', attributes: [
    cat('Trousers'), waist(WAIST_SIZES, 'No waist sizes in source; vertical default applied (30–36)'),
    attr('material', 'Stretch twill', { evidence: 'Curated description' }),
  ] },
  { match: 'men-s-spring-hooded-casual-jacket', slug: 'hooded-jacket-blue', title: 'Spring Hooded Casual Jacket — Blue', attributes: [
    cat('Hoodies & Jackets'), tops(), colour('Blue', 'Name + raw "Color: Blue"'),
  ] },
  { match: 'berrykey-men-s-color-block-hoodie', slug: 'berrykey-fleece-hoodie', title: 'Berrykey Fleece-Lined Colour-Block Hoodie', attributes: [
    cat('Hoodies & Jackets'), tops(), colour(['Olive', 'Black', 'Tan'], 'Curated: "three-tone … olive, black, and tan" (one colourway, not a choice)'),
    attr('fit note', 'Asian sizing — order one size up', { evidence: 'Raw Q&A: "Asian-sized — order one size larger"' }),
  ] },
  { match: 'fashion-boutique-ankara-hoodies', slug: 'ankara-trim-hoodie', title: 'Ankara-Trim Heavyweight Hoodie', attributes: [
    cat('Hoodies & Jackets'), tops('Raw: "Sizes from Small to 2xl"'), colour('Multi', 'Ankara print trim'),
  ] },
  { match: 'men-s-button-shirt-men-casual', slug: 'casual-print-shirt', title: 'Casual Print Long-Sleeve Shirt', attributes: [
    cat('Shirts'), attr('size', ['XL', 'XXL', '3XL'], { filterable: true, selectable: true, evidence: 'Raw: "Size:XL-3XL"' }), colour('Multi', 'Print shirt'),
  ] },
  { match: 'dou-color-men-s-casual-long-sleeve', slug: 'checkered-shirt-black', title: 'Long-Sleeve Checkered Shirt — Black', attributes: [
    cat('Shirts'), tops(), colour(['Black', 'White'], 'Curated: "black and white plaid"'),
  ] },
  { match: '4-in-1-set-plain-round-neck', slug: 'plain-tees-4-pack', title: 'Plain Round-Neck Tees — 4 Pack', attributes: [
    cat('T-Shirts & Polos'), tops(), colour(['Black', 'White', 'Yellow', 'Light blue'], 'Raw: "Colors: Black, White, Yellow, Light blue" — all four in the pack'),
    attr('pack', '4 tees', { evidence: 'Name: "4 IN 1 SET"' }), attr('material', '100% cotton', { evidence: 'Name: "PURE COTTON"' }),
  ] },
  { match: 'long-sleeved-floral-men-s-slim', slug: 'floral-slim-fit-shirt', title: 'Long-Sleeve Floral Slim Fit Shirt', attributes: [
    cat('Shirts'), attr('size', ['M', 'L', 'XL', 'XXL', '3XL'], { filterable: true, selectable: true, evidence: 'Raw: "M-3XL sizes for choice"' }),
    colour('Gold', 'Curated: "bold gold-tone print" (raw mentions other colours, unnamed — logged)'),
  ] },
  // Two source listings that are the same polo in two colours → merged into one entity with a selectable colour.
  { match: 'heavy-duty-plain-cotton-polo-t-shirt-bla', mergeInto: 'cotton-polo' },
  { match: 'heavy-duty-plain-cotton-polo-t-shirt-gre', slug: 'cotton-polo', title: 'Heavy-Duty Plain Cotton Polo', basePrice: 1150, image: 'images/heavy-duty-plain-cotton-polo-t-shirt-black.jpg',
    mergedFrom: ['heavy-duty-plain-cotton-polo-t-shirt-black', 'heavy-duty-plain-cotton-polo-t-shirt-grey-black-colar'],
    description: 'A classic heavy-duty cotton polo with short sleeves and a button-spread collar. Choose all-black, or a grey body with a contrasting black collar for an instant smart-casual accent.',
    attributes: [
      cat('T-Shirts & Polos'), tops(),
      attr('colour', [
        { value: 'Black', image: 'images/heavy-duty-plain-cotton-polo-t-shirt-black.jpg' },
        { value: 'Grey, black collar', priceDelta: 50, image: 'images/heavy-duty-plain-cotton-polo-t-shirt-grey-black-colar.jpg' },
      ], { filterable: true, selectable: true, evidence: 'Two source listings (KSh 1,150 / KSh 1,200) differ only by colour' }),
      attr('material', 'Cotton', { evidence: 'Name: "Plain Cotton"' }),
    ] },
  { match: 'khaki-tactical-cargo-pants', slug: 'tactical-cargo-khaki', title: 'Tactical Cargo Pants — Khaki', attributes: [
    cat('Trousers'), waist(WAIST_SIZES, 'No waist sizes in source; vertical default applied (30–36)'),
    colour('Khaki', 'Name'), attr('material', 'Cotton-poly blend', { evidence: 'Curated description' }),
  ] },
  { match: 'berrykey-men-s-sweatshirt-color-block', slug: 'berrykey-pullover-hoodie', title: 'Berrykey Colour-Block Pullover Hoodie', attributes: [
    cat('Hoodies & Jackets'), tops(), colour(['Black', 'Grey', 'White'], 'Curated: "three-tone black, grey, and white" (one colourway)'),
    attr('fit note', 'Asian sizing — order one or two sizes up', { evidence: 'Raw: "Asian sizing standards"' }),
  ] },
  { match: 'outdoor-hiking-shirt-removable', slug: 'quick-dry-hiking-shirt', title: 'Quick-Dry Hiking Shirt, Removable Sleeves — Beige', attributes: [
    cat('Shirts'), tops(), colour('Beige', 'Name'), attr('feature', 'Removable sleeves, quick-dry', { evidence: 'Name' }),
  ] },
  { match: 'gadtom-men-s-hoodie', slug: 'gadtom-zip-hoodie', title: 'Gadtom Full-Zip Hooded Sweatshirt', attributes: [
    cat('Hoodies & Jackets'), tops(), attr('material', 'Stretch cotton', { evidence: 'Curated description' }),
  ] },
  { match: 'men-s-stylish-short-sleeve-3-in-1', slug: 'graphic-tees-3-pack', title: 'Short-Sleeve Graphic Tees — 3 Pack', attributes: [
    cat('T-Shirts & Polos'), tops(), colour(['Black', 'Apricot', 'Green'], 'Raw: "Colors: Black, Apricot, Green" — all three in the pack'),
    attr('pack', '3 tees', { evidence: 'Name: "3 in 1"' }),
  ] },
  { match: 'men-s-black-slim-fit-button-down', slug: 'black-slim-fit-shirt', title: 'Black Slim Fit Button-Down Shirt', attributes: [
    cat('Shirts'), tops(), colour('Black', 'Name'),
  ] },
  { match: 'dark-grey-t-shirt-essential', slug: 'essential-logo-tee-grey', title: 'Essential Logo Cotton Tee — Dark Grey', attributes: [
    cat('T-Shirts & Polos'), tops(), colour('Grey', 'Name: "Dark Grey"'), attr('material', 'Soft cotton', { evidence: 'Name' }),
  ] },
];

// Findings that come from reading the data, not from running the generator.
export const findings = [
  { severity: 'gap', text: 'Attribute schema has no per-value price or image. The two polo listings (KSh 1,150 black / KSh 1,200 grey) only merge cleanly with an optional `priceDelta` and `image` on attribute values — added as a schema extension here; needs a decision in the composition spec.' },
  { severity: 'gap', text: 'Only 4 of 21 source products state a size run. The rest get a vertical default (tops S–XXL, waist 30–36), flagged `assumed: true` in the vault so the seller can confirm.' },
  { severity: 'conflict', text: '"Slim Fit Black Denim Jeans" — name says black, raw spec says "Color: Grey". Vault follows the name and the photo.' },
  { severity: 'gap', text: 'Floral slim-fit shirt raw copy says "colors … for choice" but never names them; only the pictured gold print is listed.' },
  { severity: 'gap', text: '"Fashion Side Pocket Jeans" and "Gadtom Full-Zip Hoodie" have no colour in name or copy, so they carry no colour attribute and won\'t appear under any colour filter.' },
  { severity: 'note', text: 'Colour-block hoodies and multi-packs list several colours, but as one colourway/set, not a choice — colour is filterable there but not selectable.' },
];
