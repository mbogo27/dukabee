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
4. **Preview**: the real store (search on name + category, filters on category / price range / the flexible attribute, cart, Buy Now) plus **"I want this store"**: an intent-capture form saved to the leads table. No payment.

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
