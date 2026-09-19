# Duka Bee — Kiwanda web mode demo

Rebuilds Taskbee's three demo shops (Kladi, Jikoni, Rembo) with one generator, following
`kiwanda-composition-web-mode-spec.md` and `kiwanda-taskbee-demo-migration-spec.md`.

```
npm run import     # snapshot Taskbee data → sources/  (TASKBEE_DIR overrides the default path)
npm run generate   # headless: all demos → out/<demo>/   (or: npm run generate -- kladi)
npm run check      # structural acceptance checks over out/
npm run studio     # Duka Bee Studio → http://localhost:4321 (local tool, not deployed)
npm run build      # assemble dist/ for Cloudflare Pages
npm run preview    # serve dist/ → http://localhost:8788
npm run dev        # build + local Worker (static site + /api) at http://localhost:8787
npm run deploy     # build + npx wrangler deploy
```

## Launch flow (docs: `duka-bee-mvp-spec.md`)

`/launch/` is a four-step, no-signup flow. The store preview is the pitch, and nothing is paid for before the seller sees it.

1. **Brand**: store name; logo upload (brand colour is sampled from it), or a Brand Kit (colour + style + optional wordmark), or the Duka Bee house style.
2. **Details**: description, WhatsApp/phone, location, delivery & returns (presets + a note).
3. **Catalog**: 3 to 5 products (name, price, photo, description, category, one flexible attribute). Seed from one of 8 niche templates (`launch/niches.mjs`) or start blank; everything is editable.
4. **Preview**: the real store (search on name + category, filters on category / price range / the flexible attribute, cart, Buy Now), with a **Fullscreen** button (a phone-sized store on phones, desktop-sized elsewhere). The preview comes first on every screen size; the **Claim & launch · KSh 10,000** card follows it. It's intent capture only, no payment: the form saves a lead and opens WhatsApp to Duka Bee (`launch/config.mjs` → `CONTACT_WA`) with a structured, prefilled message (store, catalog, brand, contact details, add-ons, lead ref).

The draft lives in `localStorage` (`dukabee:draft:local`), so a refresh loses nothing. Stores render in the browser from a draft or from a shareable sample link (`/store/?name=&wa=&cat=&seed=`) via the same Kiwanda composer and runtime as the demos.

## Leads (backend)

`worker/index.mjs` is a Cloudflare Worker (only `/api/*` runs it; everything else is served as static assets).
Leads are stored in a SQLite-backed Durable Object, so there is **no database to create**.

| Route | |
|---|---|
| `POST /api/leads` | public; validates, honeypot, 5/hour/IP limit, saves the lead + the store draft |
| `GET /api/leads`, `GET /api/leads/<id>` | need `Authorization: Bearer <ADMIN_KEY>` |
| `/admin/` | leads table; "Open store" re-renders that lead's draft |

Set the admin key once: `npx wrangler secret put ADMIN_KEY` (or Cloudflare dashboard → Worker → Settings → Variables and Secrets).
Local: `npm run dev` (builds, then `wrangler dev` at http://localhost:8787; add `--var ADMIN_KEY:test` to use /admin/).

## Deployed site (dist/)

| Path | What |
|---|---|
| `/` | Landing: hero, launch card, sample stores by niche, three pipeline-built demos |
| `/launch/` | The four-step flow |
| `/store/?draft=local` or `/store/?name=…&wa=…&cat=…&seed=…` | Store rendered in the browser |
| `/demos/kladi/`, `/demos/jikoni/`, `/demos/rembo/` | The three pipeline-built demo stores |
| `/addons/` | Optional add-ons (bulk product upload, M-Pesa, WhatsApp integration, logo + brand kit), mirrored from taskbee.co.ke/addons; picks travel with the launch request |
| `/admin/` | Leads (needs `ADMIN_KEY`) |

Duka Bee's own WhatsApp number and the activation fee are in `launch/config.mjs`.

No dependencies; Node 20+.

## Pipeline

| Stage | Code | Output |
|---|---|---|
| Inventory | `scripts/import-taskbee.mjs` | `sources/<demo>/source.json` + images |
| Compress → brand.md | `pipeline/brandmd.mjs` | `out/<demo>/brand.md` (then parsed back; the composer only sees what brand.md says) |
| Expand → vault | `pipeline/vault.mjs` + `pipeline/mappings/<demo>.mjs` | `out/<demo>/vault/shop.json`, `vault/products/*.json` |
| Compose | `kiwanda/atoms → molecules → sections → templates → pages` | page HTML |
| Pages | `pipeline/run.mjs` | `out/<demo>/site/` (static, self-contained) |

`pipeline/mappings/<demo>.mjs` holds the per-demo data decisions: brand tokens, and each product's
attributes with `filterable` / `selectable` flags plus the evidence for them. The generator has no
per-vertical branches.

Findings (schema gaps, data conflicts, mapping decisions) are written to `out/<demo>/findings.md`
and shown in the studio.

## Schema extension

Attribute values may carry an optional `priceDelta` and `image` (used by the merged Kladi polo).
This is not in the composition spec yet. It's logged as a finding for a decision.

## Brand assets

The Duka Bee logo and favicon are the Taskbee bee (`brand-src/taskbee-logo-light.jpg`, identical to the file on taskbee.co.ke).
`python scripts/make-brand-assets.py` (needs Pillow) rebuilds the transparent bee marks, `favicon-*.png`, `apple-touch-icon.png` and `favicon.ico` in `web/`.

The three hero feature-card icons are free Flaticon icons: `browser` by Smashicons, `dealing` by Umeicon and `growth` by Magnific
(`web/brand/icons/`). Flaticon's free licence requires crediting the authors, which the landing footer does; keep that credit if
you keep the icons. Brand logos such as the WhatsApp icon are Editorial-licence only and shouldn't be used on the marketing page.

## Analytics (Google Analytics 4)

Tag `G-72B43QCD46`, loaded from `web/analytics.js` (a standard gtag.js setup in one shared file). It is on the landing page, `/launch/`,
`/addons/`, the three demos and the sample stores. It is **not** on `/admin/`, the launch-flow preview or (later) real seller stores, and it does not
load on localhost, so your own testing stays out of the reports.

| Event | When | Parameters |
|---|---|---|
| `store_preview` | the store preview is shown (once per visit to /launch/) | niche, brand_mode, product_count, has_own_photos, device |
| `store_enquiry` | the claim form is submitted | same, plus saved, addon_count, addons, best_time |
| `claim_click` | "Claim & launch" tapped | same as store_preview |
| `launch_step` | each wizard step viewed | step_name, step_number |
| `sample_store_click`, `demo_store_click`, `demobar_click` | sample store / demo opened, "Built with Duka Bee" bar clicked | niche or demo |

Enquiries per preview = `store_enquiry` / `store_preview`. In GA4: Admin > Events > mark `store_enquiry` as a key event, and register the
parameters you want to report on under Admin > Custom definitions. Add `data-track="event_name"` (plus `data-track-*` parameters) to any element to track its clicks.
