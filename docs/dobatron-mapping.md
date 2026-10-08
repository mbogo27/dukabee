# Dobatron spec → repo mapping

Required by `dobatron-store-spec.md` §0.2. Like `docs/v2-mapping.md`, the spec assumes Astro; this repo is Kiwanda
(plain template-literal HTML, no framework, no dependencies). Dobatron is built as a **store on Duka Bee**: every
capability it needs is a generic, opt-in Kiwanda module ("storefront v2"), switched on by Dobatron's data. Kladi,
Jikoni, Rembo and Faith are untouched and still render through the v1 composer (`npm run check` passes).

## Where things live

| Spec | Repo |
|---|---|
| `scripts/dobatron-import.ts` | `scripts/dobatron-import.mjs` (repo is `.mjs` throughout). Generic parts in `pipeline/supplier-import.mjs`; laptop spec parsing in `pipeline/verticals/laptops.mjs`; `.xlsx` reading with no dependency in `scripts/lib/xlsx.mjs` |
| `data/dobatron/{source,models,store,products}.json` | Same paths. `store.json` = seed `pricing, store, categories, attributes, priceBuckets, banners, homepage` |
| `reports/dobatron-import-YYYY-MM-DD.md` | Same path, written per run |
| `src/content/guides/*.md` (Astro content collection) | `data/dobatron/guides/*.md`, read through `FileContentSource` (`kiwanda/v2/source.mjs`) |
| `CatalogSource` | `JsonCatalogSource` in `kiwanda/v2/source.mjs`. All storefront reads go through it |
| remark-directive embeds | `kiwanda/v2/markdown.mjs` (frontmatter, headings, paragraphs, lists, inline marks, `::product/::products/::compare` with line numbers) |
| `composeHomepage` (v2 Phase 3) | `kiwanda/v2/compose.mjs`: vocabulary, the 3 recipes, tiers, rules 1–7, `{filter}` rail source, labelled tabs, `sort/limit/seeAll`, `filter` banner target, `{count}/{fromPrice}` tokens, `guideTeaser` |
| Product page (v2 Phase 2) + Dobatron additions | `kiwanda/v2/pages.mjs` (`/p/<slug>`) |
| Checkout presets (v2 Phase 4) | `checkoutForm` in `kiwanda/v2/sections.mjs` (field library; options follow confirmed policies) + message builder in `kiwanda/runtime/storefront.js` |
| Island props / client search index | One inline `<script type="application/json" id="sf-index">` on `/shop`: slim entries (`indexEntry` in `kiwanda/v2/catalog.mjs`), no `cost` |
| Filters, facet counts, search, sort | `kiwanda/v2/catalog.mjs`. Isomorphic: the build and the browser import the same file, so pre-rendered counts and live counts can't drift |
| Astro build | `scripts/build-storefront.mjs` (also run by `npm run build`) → `dist/stores/dobatron/` |
| Routes `/`, `/shop`, `/p/[slug]`, `/guides`, `/guides/[slug]` | `index.html`, `shop.html`, `p/<slug>.html`, `guides.html`, `guides/<slug>.html`. Cloudflare's asset layer serves them extensionless; `worker/index.mjs` maps `dobatron.com` → `/stores/dobatron`; `www.dobatron.com` and `dobatron.dukabee.co.ke` 301 to it |

## Spec §9 core capabilities → implementation

| Capability | Where |
|---|---|
| `AttributeDef` schema (filterable/selectable/display/order) + `summary`, `valueSummaries`, `valueHints`, `explainer` | `data/<store>/store.json` → `buildFacets`, spec table, compare table, WhatsApp filter summary |
| Faceted filters with counts, URL state, mobile sheet | `catalog.mjs` + `/shop` in `pages.mjs` + `storefront.js` (pushState, back/forward, reload) |
| Client search with aliases, cost-free | `models.json` `searchAliases`; `normalizeSearch` folds "2 in 1", "elite book", "think pad", "mac book" |
| `modelId` grouping + "Other configurations" | `pages.mjs` (chips show only the attributes that differ) |
| `inferred` marks + footnote | `pages.mjs` (≈ on spec table and compare table; extra notes via `store.inferredNotes`) |
| Out-of-stock request mode | importer lifecycle + `pages.mjs` (greyed "Last listed at", Request CTA, `OutOfStock`) + `catalog.pool` (hidden from the default listing, last when filtering) |
| Homepage composer additions, banner tokens | `compose.mjs` |
| `bannerFallback: "flat"` | `sections.mjs` (`gradient` still available for other stores) |
| Guides, embeds, `guideTeaser` | `markdown.mjs`, `pages.mjs`, `compose.mjs` |
| Pricing rule + private `cost` | `priceFromCost`; `publicProduct` strips it; the build **fails** if a `cost` key or any cost figure appears in output (`privacyLeaks`) |
| `checkout.closingLine` | `store.json` → message builder |
| "Store built on Duka Bee" footer credit | `store.poweredBy` → `footer()` |
| Supplier-sheet importer pattern | `pipeline/supplier-import.mjs` + a vertical module |

## Decisions and interpretations

- **Registry additions** (`models.json`): `typicalCpuGen` (null where a model spans generations: X270, Latitude 7280, 11e Yoga, X1 Yoga, ProBook x360 11 G5), `typicalRyzenSeries` for AMD models (drives Windows 11: 2000 → Check, 3000+ → Yes), `searchAliases`, and `aliasFlags`, which marks the sheet alias `Apple | MacBook Pro (2018)` (no size) as `screen-ambiguous`.
- **Duplicates:** kept at the higher price. Stated facts beat inferred ones, extras are unioned, and `inferred` is the intersection.
- **Curated fields survive re-imports:** `featured`, `bestseller` and `createdAt` come from the previous `products.json`. Set `customDescription: true` on a product to keep a hand-written description.
- **Price inversion:** same model, same CPU family, and ≥ on CPU tier, RAM, storage and touch, better on at least one, yet cheaper. On this sheet that finds exactly the two in §12.
- **Out of stock:** hidden from the default `/shop` listing and rails; shown (sorted last) once any filter or search is active; the page stays live and in the sitemap.
- **Rule 4 (≤2 appearances)** is enforced, so the "Business laptops" grid skips the Latitude 5400 (already in Staff picks and the Touchscreen tab) and shows the next cheapest.
- **`featured` rail source** tops up with other products when fewer than 4 are flagged, so small stores still get a product grid.
- **Canonical domain:** `dobatron.com` (`store.domain`). Canonicals, sitemap, JSON-LD and `og:image` use it.
- **Contact:** WhatsApp and calls go to `+254717571951` (`store.whatsapp`, `store.phoneDisplay`). It replaces the spec's 0743 747 496, which is Duka Bee's own number.
- **Photos:** keyed by model. `python scripts/dobatron-images.py <folder>` converts `<modelId>-01.jpg|png|webp` (any subfolder) to WebP in `data/dobatron/images/` and updates `models.json`. Models without their own photo borrow one per `data/dobatron/image-standins.json`; the product page then says "Photo shows a similar model". The build fails if a model points at a missing image.
- **`/shop?…` noindex:** the worker sends `X-Robots-Tag: noindex, follow` on filtered views; the page also adds the meta tag client-side. Canonical is `/shop`.
- **Analytics:** events (`sourcing_request`, `guide_embed_click`, `add_to_cart`, `begin_checkout`, `checkout_preview`, `whatsapp_order`, `ask_click`, `request_click`) go to `window.dataLayer` (and `gtag` if a store adds one). No GA tag on seller stores, per the README.

## Testing

`npm test` runs 41 tests (`node:test`, no dependencies):
- `tests/dobatron/`: import snapshot, catalog, `composeHomepage` and build output, covering spec §10.1–10.7.
- `tests/browser/`: headless Chrome/Edge over CDP. Covers 360px overflow, filter state across reload and back, live search, the empty state and tabs. Skips when no browser is installed.

**Import fixture:** `laptop_stock_no_markup.xlsx` wasn't in the repo, so `tests/fixtures/dobatron/make-fixture.mjs` rebuilds a stand-in from the spec's catalog. It keeps the same 68 rows, row numbers, aliases and costs, including the low half of each duplicate pair. Drop the real sheet at `data/dobatron/source/laptop_stock_no_markup.xlsx` and the snapshot test uses it instead. If it fails there, the parser needs the sheet's real wording.

Lighthouse 12 (local preview): SEO 100 and Accessibility 100 on `/`, `/shop`, a product page and the guide.

## Deploy

Live on **https://dobatron.com** since 2026-10-08 (worker `dukabee`, version 744bb333).

- `npm run deploy` builds everything (including `dist/stores/dobatron`) and deploys the `dukabee` worker, which also serves dukabee.co.ke and Faith's store.
- dobatron.com is attached with **Worker routes** (`dobatron.com/*`, `www.dobatron.com/*` → `dukabee`, zone `dobatron.com`), not Custom Domains. The zone's existing DNS records (an A record to a cPanel host at 185.166.155.186, plus MX/SPF/DKIM/CalDAV records) are left untouched. To undo, delete the two routes in Cloudflare → dobatron.com → Workers Routes.
- The worker answers `dobatron.com` from `/stores/dobatron`, and 301s `www.dobatron.com` and `dobatron.dukabee.co.ke` to it.
- **Email:** MX points at `dobatron.com`, whose A record is proxied, so mail to @dobatron.com probably doesn't arrive. That was already the case before this deploy. To use cPanel mail, point MX at an unproxied `mail` A record.

## Still to confirm (spec §12): where each answer goes

| Item | Change |
|---|---|
| Markup % | `pricing.markupPct` in `store.json`, then re-run the importer. The build warns on any guide embed that leaves its band |
| Duplicate prices | Edit the sheet (or `products.json` price) for the 4 pairs in the report |
| Policies (delivery, pickup, warranty, returns) | Move items from `store.policiesToConfirm` to `store.policies`; add `checkout.pickupPoints`. With ≥2 policies the trust strip appears automatically |
| Condition (used vs refurbished) | `store.condition`, `store.itemCondition` (`RefurbishedCondition`) |
| Domain | Done: `dobatron.com` |
| Mini PC naming, X390 Yoga twins, inferred specs | `models.json` (name/blurb/aliases) or the sheet |
