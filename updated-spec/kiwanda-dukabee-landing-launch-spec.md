# Duka Bee — Intro / Launch Page

**Goal:** the public-facing Duka Bee landing page — explains what Duka Bee is, showcases Kladi/Jikoni/Rembo as clickable proof-of-work, and includes a "Launch your store" flow that runs a seller's own input through the same pipeline that built the three demos.

## Structure (reuses the existing composition vocabulary)

- **Hero section** — what-is-Duka-Bee headline/subcopy (same `hero` section shape already built)
- **Launch form** — new molecule: text input + button. Below or beside it, the three input mode options (see below)
- **Proof-of-work showcase** — a card-grid section, same shape as the product grid but cards are stores instead of products: each of Kladi/Jikoni/Rembo as a clickable preview card (thumbnail, name, one-line description) linking through to that store's live pages

## Launch flow — three intake modes, different risk for today

1. **Dummy data** — lowest risk, essentially free. Reuses one of the three already-proven demo pipelines (or a generic canned catalog), no real input required. Safe to have live for today's pitch.
2. **Manual catalog (≈5 products)** — this is the pre-build-form intake designed as the fallback path early on. The pipeline already ingests "assets, catalog, store copy"-shaped input — proven by all three demos. This is mostly a matter of exposing that same intake as a public form instead of pre-loaded files. Realistic to have working today.
3. **IG username/link** — automated brand ingestion: scrape recent posts, filter to product posts, extract brand tokens. This was flagged early on as the single biggest unbuilt piece in the whole system, and nothing built or validated since then has touched it — everything shown working so far draws from pre-structured demo data, not a live scrape. **Recommendation: keep this visible in the UI but stubbed ("coming soon" / disabled) for today's pitch** rather than risk a live scrape failing in front of five people. Full build is separate, later work — flag if you want it prioritized instead of the other two.

## Carried over from today's demo feedback

- **Buy Now** — product CTA set is Add to Cart + Buy Now, same mechanism, Buy Now auto-opens the cart overlay (full detail in the composition spec)
- **Token contrast safety** — applies here too: any store generated from this launch flow needs the same contrast-safety check on extracted tokens, not just the three original demos

## Acceptance criteria

- [ ] Landing page renders hero, launch form, and proof-of-work showcase with all three demos clickable through to their live pages
- [ ] Dummy-data launch path generates a working store end-to-end, live for today's pitch
- [ ] Manual-catalog launch path (≈5 products) generates a working store end-to-end, live for today's pitch
- [ ] IG-link input is present in the UI; whether it's stubbed or wired live is an explicit decision, not a silent gap
- [ ] Newly launched stores inherit Buy Now and the token contrast-safety fix from the composition spec
