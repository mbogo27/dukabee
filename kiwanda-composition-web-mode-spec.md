# Kiwanda Composition — Web Mode Extension (Duka Bee MVP)

**Context:** Duka Bee's MVP page set is locked — homepage, shop (with filters), one page per product. No category pages, no about/contact, Zoom Map out of the critical path. This spec extends Kiwanda's composition domain to render these pages, using an atomic-design layer stack (atoms → molecules → sections → named templates → pages) so that named templates and true semantic primitives aren't competing approaches — the named templates are just the top two layers of one shared decomposition.

## Why one shared vocabulary, not a hard mode fork

Fixed-canvas composition (posters) assumes one bounded frame, hard copy-length caps (the Emphasis principle), no persistent chrome. Web pages have fluid width/height, seller-controlled content length, and chrome that persists across page boundaries. Rather than forking composition into two parallel vocabularies, atoms and molecules stay identical across both — a button is a button whether it's on a poster or a product page. The fork happens only at the template/page layer, where layout rules (bounded canvas + copy caps vs. fluid width + persistent chrome) get applied.

## Layer stack

### Atoms
div, button, heading, paragraph, list / list-item, image. No styling, no behavior. Shared across fixed-canvas and web mode.

### Molecules
Small atom groupings: CTA (button + label), stat block (heading + paragraph), media frame (image + caption), product-card (image + heading + price + CTA), cart-line-item (image + heading + quantity + remove-button + selected attribute values), **attribute-selector** (label + set of options) — generic, reusable across any attribute name/value set: Kladi's size/color, Jikoni's capacity/material, Rembo's shade/volume are all the same molecule with different data.

### Sections (composite-of-composites)
Where styling and logic attach — this is the layer that binds a button atom to an actual behavior (e.g. firing the WhatsApp checkout flow), rather than the atom carrying behavior itself.
- **Header** — logo (from brand.md), nav (fixed for MVP: Home, Shop), cart icon with item-count badge
- **Footer** — contact/WhatsApp link, minimal
- **Product grid** — product-card molecule repeated N times; must tile an unbounded, seller-controlled item count with responsive reflow, not a fixed slot count
- **Product detail** — image + text-zone shape (adapted from `hero-photo-stat` / `list-with-mockup`). One attribute-selector instance per attribute flagged `selectable` (see schema below), placed above Add to Cart; Add to Cart stays disabled until every selectable attribute has a chosen value. Attributes not flagged selectable render as plain descriptive text, no selector. Copy handling inverts from posters — variable-length seller-authored descriptions need graceful overflow (truncate/expand), not a hard cap
- **Hero** — near-direct reuse of `hero-photo` / `hero-photo-stat`, plus a featured-products strip (a capped instance of the product grid, 4–6 items, no pagination)
- **Filter control** — reads only attributes flagged `filterable` on the product entity, not the full attribute set. No separate category route per the MVP decision — categories are just another filterable attribute. Needs empty-state handling for zero-result filter combinations
- **Cart overlay** — new, see below

### Named page templates
Sections arranged into layout, no live data yet: shop page template = header + product-grid + footer; product page template = header + product-detail + footer. Header and footer are sections *reused across* templates, not redeclared per template.

### Pages
A template populated with real vault data: homepage, shop, and one product page instance per product entity.

## Product attribute schema

Each product entity carries a list of attributes rather than a flat key-value list. Each attribute has:
- `key` — e.g. "size", "color", "capacity", "material"
- `value(s)`
- `filterable` — true/false: surfaced as a shop-page filter facet
- `selectable` — true/false: buyer must choose a value on the product page before Add to Cart is enabled

The two flags are independent, not alternatives. An attribute can be both, one, or neither — color is commonly both (filter by color, also pick one before buying); material might be filter-only if a product has no variants; a spec like "weight: 2kg" might be neither, just descriptive text. This is what makes the schema generalize across Kladi/Jikoni/Rembo without any vertical-specific logic.

## Cart + checkout overlay

Not a page — a modal/overlay triggered by the cart icon in the header section, so it's present everywhere, not just on product pages.

- **Cart icon** (header section): icon + item-count badge
- **Cart state**: client-side, holds added products, quantities, and any selected attribute values; needs to persist across page navigation within a session (e.g. localStorage)
- **Overlay contents**: list of cart-line-item molecules (image, name, quantity, remove, selected attribute values), running total, and a button that opens the pre-checkout form — the form itself is already built and proven on Dobatron; it structures and fires the WhatsApp message
- **Product-detail CTA**: "Add to Cart" — adds to cart state, does not fire WhatsApp directly. Checkout only happens from the cart overlay.

## Data contract

Web mode's composer takes vault entities as input, not brand.md/copy the way the poster composer does:
- Shop entity → homepage + header/footer chrome
- Product entities (collection, each with its attribute list) → shop grid
- Each product entity individually → one product detail page
- Cart state is client-side only — not part of the vault, not composer output

Must run headless. Duka Bee's base tier is zero-touch, so web mode has to generate valid pages without a human in the editor UI per page — unlike the poster pipeline, where every output currently passes through editor review before export.

## Out of scope for this spec

- Category pages, about/contact — already deferred from MVP (categories are a filterable attribute, not a route)
- Zoom Map integration — out of critical path given the deterministic MVP page set
- Kiwanda editor UI support for web mode (visual tweaking) — upsell-tier concern, not needed for the zero-touch base build
- Per-product "Buy Now" shortcut, saved carts across sessions/devices — not requested

## Acceptance criteria

- [ ] Header/footer sections render consistently across all pages, sourced from brand.md tokens; header includes a functioning cart icon with item count
- [ ] Product grid handles 1 to N products with responsive reflow, no fixed slot-count assumption
- [ ] Product detail page renders one attribute-selector per selectable attribute; Add to Cart stays disabled until all are chosen; non-selectable attributes render as plain text; variable-length descriptions don't break layout
- [ ] Filter control reads only filterable-flagged attributes and handles the zero-result state
- [ ] Cart overlay opens from the header on any page, lists cart contents including selected attribute values, and its checkout button opens the pre-checkout form
- [ ] Full pipeline (vault → homepage + shop + N product pages) runs headless, no editor UI step required
