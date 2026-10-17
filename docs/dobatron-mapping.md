# Dobatron spec → repo mapping

Two specs shape this store: `dobatron-store-spec.md` (the original build, §0.2 asks for this file) and
`Dobatron Site Structure Spec.md` (2026-10-10: product tree, URLs, data model, tags, guides, trust layer, quiz). Like
`docs/v2-mapping.md`, the first spec assumes Astro; the code is Kiwanda (plain template-literal HTML, no framework, no
dependencies). Dobatron is a **store on Duka Bee**: every capability is a generic, opt-in Kiwanda module ("storefront
v2"), switched on by Dobatron's data. Kladi, Jikoni, Rembo and Faith still render through the v1 composer.

## Site Structure Spec → implementation

| Spec | Where |
|---|---|
| Data model: category, brand, series, model, offer, typed tags | `data/dobatron/taxonomy.json` (categories with `metaCategory`, brands per category, series with page copy, tag vocabulary); `models.json` gains `slug`, `category`, `brandSlug`, `seriesSlug`, `status`, `tags`; `products.json` entries are the **offers** |
| Product tree, publishing rules, namespace | `kiwanda/v2/tree.mjs` `buildTree`: paths, price ranges, price bands, generation and typical specs, related models by shared tags, breadcrumbs. Categories publish only with an available offer; brand pages only with 2+ stocked series; brand/series/model slugs share one namespace per category (a clash fails the build) |
| Flat URLs `/[category]/[slug]` | `pages.mjs`: `/laptops`, `/laptops/hp` (brand), `/laptops/hp-elitebook` (series), `/laptops/hp-elitebook-840-g6` (model), `/mini-pcs/…`. Files are `laptops.html`, `laptops/<slug>.html`; Cloudflare's asset layer serves them extensionless |
| Variants have no URL | Offers are chosen on the model page (`[data-variants]`), `?variant=<offer>` preselects one, canonical stays the model |
| Never reuse or delete a slug; 301s | `redirects.json` (generated): every `/p/<offer>` → `/laptops/<model>?variant=<offer>`, `/shop` → `/laptops`, renamed guides via `redirectFrom`. Served by `worker/index.mjs` (production) and `scripts/preview.mjs` (local) |
| Model page template | `pages.mjs` model section: photos, dated "price in Kenya" line, variant selector, Grade A, WhatsApp buttons with the model and configuration pre-filled, "Request a video of this machine", buy-with-confidence strip, specs, related guides and models from shared tags, up-link to the series. All offers unavailable → page stays, "Ask us on WhatsApp" + a similar model |
| Series page template | Summary box (range, Grade A, models, as-of date, known for), models table, one anchored "Model price in Kenya" section per model with 2–3 cards, buying advice, series FAQ (`FAQPage` JSON-LD), related guides, up-link |
| Breadcrumbs on every page | `tree.crumbs()` + `breadcrumbs()`; meta-category (Computers) and brands without a page show as text; `BreadcrumbList` JSON-LD lists the linked levels |
| Guides as records | Frontmatter: `type`, `primaryQuery`, `tagsTargeted`, `modelsFeatured`, `lastVerified`, `status`, `redirectFrom`. Product lists are queries: `::models{tags="student" band="0-30000" limit="4"}`. FAQ section → `FAQPage` JSON-LD. Breadcrumbs Home › Guides › guide |
| Trust pages | `data/dobatron/pages/{about,grade-a,how-it-works}.md` → `/about`, `/grade-a`, `/how-it-works` |
| Find-my-laptop quiz | `/find-my-laptop` (noindex): 4 questions mapped to `use_case` tags, price bands, compact/power fields and the offer `touch` field; 2–3 matches with a reason, WhatsApp carrying the answers, links to the matching use-case guide, always returns something (relaxes touch → use → budget); logs `quiz_complete` |
| Condition: Grade A only | `store.condition` and every offer's `condition` attribute; JSON-LD `RefurbishedCondition` |
| Canonicals, sitemap on .co.ke | `store.domain = "dobatron.co.ke"`; sitemap lists home, categories, brand, series, models, guides, trust pages (not the quiz, filters or legacy URLs) |
| Filter views not indexed | client-side `noindex, follow` on `?` views, canonical to the category; the worker adds `X-Robots-Tag` on `/laptops?…` |

## Decisions and interpretations (Site Structure Spec)

- **Mini PCs are their own category** (`/mini-pcs`, meta-category Computers): they are stocked, and they aren't laptops. The old categories (business laptops, 2-in-1, MacBooks, workstations) became series pages and the Type/Series filters.
- **Slugs are the existing model ids**, frozen. Two keep a year or size because it is part of the model's name, not a changing attribute: `apple-macbook-pro-13-2012/2017/2018`.
- **Tags** were assigned once from the data (`touchscreen`, `2-in-1`, `dedicated-graphics`, `stylus`, `compact`, `windows-11-ready`, `macos`; `student`, `business`, `coding`, `design` by rule) and are now hand-editable. Unverifiable features (backlit keyboard, USB-C charging, long battery) are **not** tagged. `price_band` is computed from offer prices at build so it can't go stale.
- **Price ranges** come from offers; the "as of" date is the stock import date (`products.json` `generatedAt`). Market research isn't included yet.
- **Category listing shows offers** (each configuration), linking to its model with `?variant=`, so filters and counts stay exact.
- **Budget guide renamed** to `/guides/best-refurbished-laptops-kenya-by-budget` (301 from the ex-UK slug) and reworded for the Grade A positioning; three use-case guides added (students, programming, design). "How we test a laptop" waits for the inspection checklist.
- **Claims:** "ex-UK" and "In stock" are gone; offers say "Available through our supplier network · confirm on WhatsApp". The build tests enforce this.
- **Not built yet (spec says later or when justified):** meta-category pages, other brand pages, expanded model sections (price by spec, strengths and weaknesses), comparison guides, curated tag pages.

## Original store spec → implementation

| Spec | Where |
|---|---|
| Importer (`scripts/dobatron-import.ts`) | `scripts/dobatron-import.mjs`; `pipeline/supplier-import.mjs` + `pipeline/verticals/laptops.mjs`; `.xlsx` with no dependency in `scripts/lib/xlsx.mjs` |
| `CatalogSource` / `ContentSource` | `kiwanda/v2/source.mjs` (`JsonCatalogSource` + `getTaxonomy`, `FileContentSource` for guides and pages) |
| `composeHomepage` | `kiwanda/v2/compose.mjs`: vocabulary, recipes, tiers, rules 1–7, filter/series banner targets, `{count}/{fromPrice}`, series navigation (`items: "series"`) |
| Filters, counts, search, sort | `kiwanda/v2/catalog.mjs`, shared by build and browser |
| Checkout presets | `checkoutForm` in `sections.mjs` + message builder in `runtime/storefront.js` |
| Private `cost` | stripped by `publicProduct`; the build fails if a `cost` key or figure reaches the output |

Earlier decisions still apply: duplicates kept at the higher price, curated fields (`featured`, `createdAt`, `customDescription`) survive re-imports, price inversions as defined in the import report, out-of-stock offers hidden from default listings, ≤2 appearances per product on the homepage, photos keyed by model with labelled stand-ins (`image-standins.json`).

## Testing

`npm test` runs 53 tests (`node:test`, no dependencies): import snapshot, catalog engine, homepage composition, build output (URL scheme, redirects, namespace, page templates, breadcrumbs, guides, trust pages, claims, canonicals, sitemap, privacy) and headless-browser checks (360px, filter state across reload/back, legacy redirect → variant, quiz).

## Deploy

Live on **https://dobatron.co.ke** since 2026-10-13 (worker `dukabee`, version 0e5bb9a5, `DOBATRON_CO_KE_LIVE = true` in `worker/index.mjs`).

- Zone `dobatron.co.ke` (nameservers `lilith`/`neil.ns.cloudflare.com`): proxied placeholder records `A dobatron.co.ke → 192.0.2.1` and `CNAME www → dobatron.co.ke`, answered by Worker routes `dobatron.co.ke/*` and `www.dobatron.co.ke/*` → `dukabee`.
- Zone `dobatron.com`: Worker routes `dobatron.com/*` and `www.dobatron.com/*` → `dukabee`, which 301s them to dobatron.co.ke. Its DNS records (cPanel A record, MX/SPF/DKIM/CalDAV) are untouched.
- The worker serves dobatron.co.ke from `/stores/dobatron`, 301s `www.dobatron.co.ke`, `dobatron.com`, `www.dobatron.com` and `dukabee.co.ke/stores/dobatron/…` to it, answers `redirects.json` (legacy `/p/…`, `/shop`, renamed guides) with 301s, and sends `X-Robots-Tag: noindex, follow` on filtered views.
- To publish changes: edit here, sync to the Duka Bee repo (same paths), `npm run deploy` there.

### Domain migration (2026-10-17, branch `dobatron-coke-migration`, worker version 78a55536)

- **Search Console:** both properties verified by DNS TXT records in Cloudflare (they survive the redirect); the two `google-site-verification` meta tags are also on every page (`store.seo.verification`). Change of address from dobatron.com to dobatron.co.ke submitted in Search Console.
- **Redirect source:** `data/dobatron/redirects.csv` (old_path,new_path; 64 old `/p/` offers, `/shop`, the renamed budget guide). Edit it to add or change a redirect; the build adds rows for new offers and renamed guides, rejects chains and dead targets, and publishes `redirects.json` for the worker.
- **Worker rules** (`worker/index.mjs`, tests in `tests/worker/dobatron-redirects.test.mjs`):
  - dobatron.com and www.dobatron.com, http or https: one 301 to the final page on `https://dobatron.co.ke`. Order: redirect map, then the same path if it exists, then the nearest existing parent page, then the homepage. Query strings kept. `robots.txt` and `sitemap.xml` on .com 301 to the .co.ke files.
  - dobatron.co.ke: http → https, `www` → apex, trailing slash dropped, legacy paths mapped, each as a single 301. Unknown paths are real 404s.
  - No noindex and no robots.txt block on .com, so Google can crawl the redirects.
- **Keep the redirects and dobatron.com's DNS records for at least a year** (Google's guidance for a change of address is a minimum of 180 days).

**Email:** MX for dobatron.com points at a proxied hostname, so mail there probably doesn't arrive (already the case before Dobatron). Set up mail on dobatron.co.ke with an unproxied mail record.

## Still to confirm

| Item | Change |
|---|---|
| Markup % | `pricing.markupPct` in `store.json`, then re-run the importer |
| Duplicate prices (4 pairs) | the sheet, or `products.json` |
| Warranty, returns, delivery, pickup | `store.policies`, `checkout.pickupPoints`, `pages/how-it-works.md` |
| Grade A criteria and battery threshold | `pages/grade-a.md` (currently lists what is checked, thresholds pending) |
| Godfrey on About; origin story; response hours | `pages/about.md` |
| Price-range method (market research) | today's ranges come from offers only |
| Final tag list (20–40) | `taxonomy.json` `tags` + model `tags` |
| Lower grades in data? | not stored; only Grade A exists in the data |
