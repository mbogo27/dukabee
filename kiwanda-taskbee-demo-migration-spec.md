# Kiwanda Demo Migration — Kladi, Jikoni, Rembo

**Goal:** Rebuild Taskbee's three existing demo shops using the Kiwanda grammar and web-mode composition spec, sourcing content from the existing taskbee-demos Claude Code project rather than starting from scratch. This is Duka Bee's MVP: three automated store builds proving the pipeline generalizes across verticals.

**Handoff note:** this spec applies the companion `kiwanda-composition-web-mode-spec.md` to three concrete demos — read that spec first for the full layer stack (atoms → molecules → sections → templates → pages), attribute schema, and cart/checkout overlay design. This file only covers what's specific to the migration.

## Why these three are a good test set

Three genuinely different verticals — Kladi (clothes), Jikoni (kitchen appliances/utensils), Rembo (cosmetics) — stress-test whether one composition pipeline actually generalizes across catalog shapes, not just brand colors. Same generator, three structurally identical but visually distinct outputs.

Since assets, catalog, and store details already exist for all three, this pass tests the brand.md → vault → composition pipeline specifically, not the ingestion/scraping problem — IG-scrape automation is still a separate, later validation.

## New project scope

A new Claude Code project, separate from the existing taskbee-demos project, that:

1. **Inventory existing data** — read the current taskbee-demos project's assets, catalog data, and store details for each of the three demos (logo, any existing brand colors, product data, shop name/description)
2. **Compress to brand.md** — per demo, following the same shape used for PaySii (text, entities, relations, references); logo gets sampled for color tokens where no brand colors are already defined
3. **Expand to Ramani vault** — shop entity + product entities per demo, three separate vaults. Each product entity's attributes get tagged `filterable` / `selectable` per the schema in the composition spec during this step — this is a data-mapping decision per demo, not a new build
4. **Render via web-mode composition** — run each vault through the atoms → molecules → sections → templates → pages stack: home, shop, one page per product, shared header/footer, cart overlay
5. **Output** — three regenerated demo sites, same underlying templates and generator, different brand tokens, catalog content, and attribute sets

## Attribute mapping per demo (illustrative, confirm against actual catalog data)

- **Kladi** (clothes) — size, color: both filterable and selectable
- **Jikoni** (kitchen) — capacity, material: likely filterable; selectable only if a given product actually comes in more than one variant
- **Rembo** (cosmetics) — shade, volume/ml: shade likely both filterable and selectable; volume may be filterable only if sold in multiple sizes

What looked like a clothing-specific variant problem is resolved generically by the attribute schema — no per-vertical special-casing needed, just correct filterable/selectable flags per attribute during vault construction.

## Out of scope (carried over from the composition spec)

- Category pages, about/contact, Zoom Map integration
- Per-product "Buy Now" shortcut bypassing the cart
- IG-scrape ingestion — this migration uses already-existing demo data, not the automated intake path

## Acceptance criteria

- [ ] All three demos regenerated with home/shop/product pages, shared header/footer, working cart overlay
- [ ] Each demo's brand.md correctly derived from its existing assets/catalog/store details
- [ ] Visual distinctiveness confirmed across all three despite sharing the same templates and generator
- [ ] Each demo's product attributes correctly flagged filterable/selectable during vault construction, verified against actual catalog data (not just the illustrative mapping above)
- [ ] Product-detail attribute-selectors work correctly per demo (e.g. Kladi's size/color gate Add to Cart)
- [ ] Any other catalog-shape gaps across the three verticals logged as findings rather than silently dropped
