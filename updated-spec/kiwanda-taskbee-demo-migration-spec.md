# Kiwanda Demo Migration — Kladi, Jikoni, Rembo

**Status:** Built and working. All three demos generated end to end (20/15/21 products, 22/17/23 pages), visually distinct, filtering and attribute selection both functioning. Remaining items are fixes, tracked in the companion composition spec.

**Goal:** Rebuild Taskbee's three existing demo shops using the Kiwanda grammar and web-mode composition spec, sourcing content from the existing taskbee-demos Claude Code project rather than starting from scratch. This is Duka Bee's MVP: three automated store builds proving the pipeline generalizes across verticals.

**Handoff note:** this spec applies the companion `kiwanda-composition-web-mode-spec.md` to three concrete demos — read that spec first for the full layer stack, attribute schema, CTA set, and cart/checkout overlay design. This file covers what's specific to the migration.

## Why these three are a good test set

Three genuinely different verticals — Kladi (clothes), Jikoni (kitchen appliances/utensils), Rembo (cosmetics) — stress-test whether one composition pipeline actually generalizes across catalog shapes, not just brand colors. Confirmed: same generator, three structurally identical but visually distinct outputs.

## Pipeline (as built)

1. **Inventory** — read taskbee-demos project's assets, catalog data, and store details per demo
2. **Compress to brand.md** — per demo: text, entities, tokens, relations
3. **Expand to vault** — shop + products, each product's attributes tagged filterable/selectable
4. **Compose** — atoms → molecules → sections → templates
5. **Pages** — static site written per demo (home, shop, one page per product)

## Findings from this build

- **Kladi contrast bug** — button text unreadable in places against Kladi's extracted background token. Root-caused to a missing contrast-safety check in brand.md's token extraction, not a Kladi-specific issue — fix tracked in the composition spec, applies to all three and any future demo.
- Filterable/selectable attribute mapping confirmed working across all three verticals (Kladi size/color, Jikoni capacity/material-style attributes, Rembo shade/volume-style attributes) — no per-vertical special-casing was needed, as expected.

## Out of scope (carried over from the composition spec)

- Category pages, about/contact, Zoom Map integration
- IG-scrape ingestion — this migration used already-existing demo data, not the automated intake path (that's the subject of the Duka Bee landing/launch spec)

## Acceptance criteria

- [x] All three demos generated with home/shop/product pages, shared header/footer, working cart overlay
- [x] Each demo's brand.md correctly derived from its existing assets/catalog/store details
- [x] Visual distinctiveness confirmed across all three
- [x] Attribute filterable/selectable flags correctly populated per demo, verified against real catalog data
- [x] Product-detail attribute-selectors work correctly per demo
- [ ] Kladi contrast bug fixed (tracked in composition spec's token-safety item)
- [ ] Buy Now added to all three once implemented in the composition spec
