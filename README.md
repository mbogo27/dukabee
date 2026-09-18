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
npm run deploy     # build + npx wrangler pages deploy dist --project-name dukabee
```

## Deployed site (dist/)

| Path | What |
|---|---|
| `/` | Duka Bee landing: hero, launch form, proof-of-work showcase (`web/`) |
| `/store/?name=…&wa=…&cat=…&seed=…` | A store generated in the browser from dummy data (`launch/dummy.mjs`) |
| `/demos/kladi/`, `/demos/jikoni/`, `/demos/rembo/` | The three pipeline-built demo stores |

Launch flow intake modes: **sample products** (live; the seller enters only shop name + WhatsApp),
**website URL** and **Instagram username** (visible, marked "coming soon"). Each generation picks a new
seed → palette, type pairing, card/button shape and hero layout, with placehold.co images tinted to the
palette. The share link reproduces the exact store. Tokens pass the same contrast-safety check as the demos.

Duka Bee's own WhatsApp for the "Talk to us" button is `CONTACT_WA` in `web/landing.js`.

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
