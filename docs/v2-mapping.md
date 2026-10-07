# v2 spec → repo mapping

Required by `dukabee-v2-spec.md` §0 before coding. The spec assumes a stack this repo doesn't have; this
maps its vocabulary onto what's actually here so later phases build on the real thing, not the assumption.

## What the spec assumes vs. what exists

| Spec assumes | Actually in the repo |
|---|---|
| Astro, with routing | No framework. `kiwanda/` is a hand-rolled static-site composer (atoms → molecules → sections → templates → pages, plain template-literal HTML); `scripts/build.mjs` assembles `dist/`; a Cloudflare Worker (`worker/index.mjs`) serves `/api/*` and falls through to static assets otherwise. No JSX, no file-based routing, no bundler. |
| 8 one-click demo niches | **3**: Kladi (fashion/clothes), Jikoni (kitchen), Rembo (cosmetics/beauty) — real catalogs scraped from Taskbee (`pipeline/`, `sources/*/source.json`), composed via `pipeline/mappings/<demo>.mjs`. `dukabee-minute-store-spec.md` (a separate, unrelated standalone project in `../dukabee-minute-store`) independently lists an 8-niche table with 5 "coming soon" — not part of this repo's demo set. |
| A JSON catalog with a "current shape" to migrate | Two different shapes, not one: (a) the **vault** (`out/<demo>/vault/shop.json` + `vault/products/*.json`) for the three pipeline demos, produced by `pipeline/vault.mjs`/`brandmd.mjs` from scraped source data; (b) the **draft** (`launch/store.mjs`'s `emptyDraft()`), the seller-facing shape used by the intake flow and kept in `localStorage`, converted to a vault-like shape in-browser by `buildVault(draft)`. Both ultimately feed the same renderer: `composeSite({shop, products}, opts)` in `kiwanda/pages.mjs`. |
| An existing intake / preview / claim flow | `/launch/` (`web/launch/{index.html,launch.js,launch.css}`): a 4-step wizard (Brand → Details → Catalog → Preview), niche seed templates in `launch/niches.mjs` (8 niches' worth of *seed data*, not full demo stores), live preview via the same Kiwanda composer rendering the draft client-side into an iframe, ending in a lead-capture form that opens WhatsApp to Duka Bee's own number (`launch/config.mjs` → `CONTACT_WA`) with a prefilled message. No domain claim step — the pitch today is a **`*.dukabee.co.ke`-flavoured** preview path (`/store/?name=&wa=&cat=&seed=`), which v2 Phase 1 explicitly must stop pitching. |
| A Truehost integration | **None.** `dukabee.co.ke` was registered and pointed at Cloudflare manually through the Truehost dashboard (human, one-time); there is no Truehost API code, no API keys, anywhere in this repo. A `DomainRegistrar` implementation needs real Truehost API credentials this session does not have — see "Open items" below. |

## Terms: spec name → repo name

| Spec term | Repo equivalent |
|---|---|
| `StoreConfig` | `shop` object (vault shape) — see `kiwanda/pages.mjs`, `pipeline/vault.mjs`, `launch/store.mjs::buildVault` |
| `Product` | product vault entity — see any `out/<demo>/vault/products/*.json` for the real shape (`id, slug, name, price, image, description, attributes[], provenance`) |
| intake | `/launch/` (`web/launch/launch.js`) |
| preview | the Kiwanda-rendered store, shown in an iframe during `/launch/` (draft) or standalone at `/store/?draft=local` / `/store/?name=&wa=&cat=&seed=` (sample link) |
| claim | the lead-capture form at the bottom of `/launch/`'s preview step → `POST /api/leads` (Worker + SQLite Durable Object, `worker/index.mjs`) → opens WhatsApp to Duka Bee |
| "8 demo niches" (v2) | this repo's 3 pipeline demos (Kladi/Jikoni/Rembo) **plus** the 8 *seed-only* niche templates in `launch/niches.mjs` used to prefill a blank draft. These are not full demo stores and have no banners/categories beyond what the seller edits in. |
| `attributes: Record<string,string[]>` | already richer in the repo: `product.attributes[]`, each `{ key, label, values:[{value, priceDelta?, image?}], filterable, selectable, evidence, assumed }` — keep this shape; it already covers variants (Phase 2), filterable facets, and per-value price deltas (used live on `stores/faith`'s "Magnetize Your Love" duration tiers). Don't flatten it to the spec's simpler type. |
| EmDash | Not present; no account/credentials in this repo or session. Phase 5 needs a decision + credentials before any code. |

## Phase-readiness, given the above

- **Phase 1** (Intake v2 + domain claim): buildable now, inside the existing vanilla-JS/Kiwanda stack — no framework migration needed. The domain-check endpoint can only honestly return `unknown` (per the spec's own fallback rule) until real Truehost API credentials exist.
- **Phase 2** (product page): mostly exists already (`kiwanda/sections.mjs::productDetail`, the `/product/<slug>.html` route) — gap is the "Ask about this item on WhatsApp" secondary CTA, `compareAtPrice` discount badge, and `Product` JSON-LD; everything else (variant chips, quantity, Add to cart, policy lines, related products) is already built.
- **Phase 3** (homepage recipes): the biggest net-new engineering in the spec — nothing like a section-vocabulary/recipe composer exists today; would be built as new pure functions (`composeHomepage`) feeding new Kiwanda sections, independent of Phases 1–2.
- **Phase 4** (checkout presets): partially exists — `kiwanda/sections.mjs::cartOverlay`'s pre-checkout form (name, delivery area, preferred delivery, notes) is a fixed form today, not a per-niche field-library/preset system; Faith's store already proved a second checkout *mode* (booking vs. delivery) is practical to add alongside it.
- **Phase 5** (EmDash): blocked on an account/credentials decision; "open checks to report back on" in the spec can't be answered without EmDash access.
- **Phase 6** (image library): explicitly spec-only per the spec itself; not started.

## Open items for Mbogo (spec §"Config values to confirm")

- `DUKABEE_WA` for v2's claim message — reuse `launch/config.mjs`'s existing `CONTACT_WA` (254743747496) unless told otherwise.
- Pricing copy: spec says "KSh 10,000 first year incl. domain + hosting; KSh 5,000/year renewal" vs. the current `/launch/` copy ("KSh 10,000 to launch, domain + hosting included," no stated renewal fee). These need reconciling before the claim screen ships.
- Truehost API credentials, for real domain availability checking (`TruehostRegistrar`).
- Enabled domain suffixes: `.co.ke` only, or also bare `.ke`?
- EmDash account/credentials, before Phase 5 can start at all.
