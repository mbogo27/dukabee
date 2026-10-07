# Duka Bee v2: Intake, Store Formula, Product Pages, Checkout, EmDash

Spec for Claude Code. Work through the phases in order; each phase ships on its own.

Images are **out of scope for now**. Everything here must look intentional with placeholders and become image-ready by data change only (see "Image slots" below). The image library is Phase 6, done after Phases 1–5 land.

---

## 0. Before you start

Inspect the repo first and adapt this spec to what exists. Specifically confirm:

- Framework and routing (expected: Astro).
- Where the JSON catalog lives and its current shape.
- How the 8 one-click demo stores are defined (which niches, which files).
- The current intake / preview / claim flow and the existing pre-checkout form.
- Any existing Truehost integration.

Where this spec's names differ from the repo, keep the repo's names and map to this spec. Write a short `docs/v2-mapping.md` noting the mapping before coding.

Reference prototype for the new intake (behaviour and copy, not code to paste): https://claude.ai/artifact/9j8sC6ZZCZcUqenjJT7PK1

---

## Phase 1: Intake v2 (3 steps) + domain claim

### Goal
Replace the current intake with a 3-step flow and a live store preview, ending in a claim pitch for the seller's **own domain** (e.g. `wanjikucloset.co.ke`), never a `*.dukabee.co.ke` subdomain.

### Layout
- Desktop: form left, sticky phone-frame live preview right.
- Mobile: form full width; floating "See your store" button opens the preview full screen; Escape / "Back to form" closes it.
- Header copy: "Your shop, online before your chai cools." / "Three quick steps. Watch your store fill in as you type, then claim it on WhatsApp. Free to preview."

### Step 1: Your shop
| Field | Rules |
|---|---|
| Shop name | Required, max 40 chars |
| What do you sell? | Required. Tiles for the 8 demo niches. Selecting one immediately loads that niche's demo catalog + banner into the preview |
| Where are you? | Optional, max 50 |

After a niche is picked, show: "Happy with the sample store? **Skip to claim it**" → jumps to Step 3. This merges the old one-click demo path into the same flow.

### Step 2: Your products
- Up to 3 products: photo (optional), name, price (digits only). Placeholders come from the niche's first 3 demo products ("e.g. Denim jacket", "KSh 3500").
- Each filled product replaces a demo product in the preview (own products first, then demo products fill up to 5 total, tagged "Sample").
- Banner headline input + 3 niche suggestion chips that fill it on tap.
- Logo upload (optional; fallback = initials badge in palette colours).
- 6 colour presets (radio): Honey & ink, Sukuma green, Ocean, Rose, Lavender, Coffee.
- "How you sell" policy pills (multi-select): Delivery in Nairobi, Countrywide delivery, Pickup point, Pay on delivery, M-Pesa accepted, Returns within 7 days, Exchange only. Default: M-Pesa accepted.
- Client-side image resize before storing (products ~520px, logo ~200px, JPEG ~0.78).

### Step 3: Claim it
- WhatsApp number, Kenyan formats accepted (`07…`, `01…`, `7…`, `2547…`); normalise to `2547XXXXXXXX` / `2541XXXXXXXX`. Inline error: "Enter a Kenyan number like 0712 345 678."
- Your name (optional).
- Summary card of the store with "Edit" → Step 1.
- Consent checkbox (required): "Duka Bee can message me on WhatsApp about this store and keep a private preview of it."
- Button: "Build my store".

### Done screen: domain claim
- Headline: "Claim **{domain}**".
- Domain candidates generated from shop name (see below); first available is preselected, others are selectable chips.
- Copy (put values in config, not hard-coded): "KSh 10,000 to go live: your domain, hosting and setup for the first year. KSh 5,000/year after." **Verify pricing copy with Mbogo before shipping.**
- Primary CTA: "Claim {domain} on WhatsApp" → `wa.me/{DUKABEE_WA}` with prefilled message:
  ```
  Hi Duka Bee! I'd like to claim my store.
  Shop: {name}
  Domain: {domain}
  Selling: {niche}
  Location: {location}
  My products added: {n}
  Colours: {palette}
  How I sell: {policies}
  Preview: {previewUrl}
  Built in: {duration}
  ```
- Secondary: "Try the store" (opens preview), "Make changes" (back to Step 1).
- Show "Built in 1m 42s" chip (time from first input to Build).

### Domain candidates
Generate in this order, dedupe, max 4:
1. `{slug}.co.ke` where slug = lowercase, ASCII letters/digits only.
2. `{slug-with-hyphens}.co.ke` (word boundaries → hyphens) if different.
3. `{slug}ke.co.ke`
4. `{slug}.ke` (only if `.ke` is enabled in config; verify registrar support)

Constraints: label ≤ 63 chars, no leading/trailing hyphen, no double hyphens.

### Domain availability endpoint
Server-side only (registrar API keys never reach the browser).

```
GET /api/domain/check?names=a.co.ke,b.co.ke
→ 200 { results: [{ name, status: "available" | "taken" | "unknown" }] }
```

- Implement behind an interface so the registrar can change:
  ```ts
  interface DomainRegistrar { check(names: string[]): Promise<DomainResult[]> }
  ```
- `TruehostRegistrar` implementation per Truehost API docs; reuse any existing integration.
- Cache results 10 min; rate-limit per IP.
- On error/timeout return `unknown`. UI rule: only say "available" when status is `available`; for `unknown` show "We'll confirm this domain in our chat."

### Preview URL
- Private, `noindex`, unguessable: `dukabee.co.ke/preview/{id}` (id ≥ 10 chars random).
- Subdomains are staging only and must not appear in any seller-facing pitch.

### Persistence
- Save intake state to localStorage on every change (try/catch; if quota fails, retry without images).
- On return: banner "We kept what you typed last time. **Start fresh**".
- On Build: persist the store draft server-side (whatever the repo uses today) so the preview URL works on another device.

### Store strength meter (under preview)
Score 0–100: name 15, niche 15, location 8, headline 8, logo 8, each own product with name+price 8 and photo +4 (max 36), ≥2 policies 10. Labels: <40 "A start", <70 "Taking shape", <90 "Looks like a real shop", else "Ready to sell". Show one "Next: …" tip.

### Comparing v2 against the current intake
- Serve both: 50/50 split by cookie, overridable with `?intake=v1|v2`.
- Log events (to whatever analytics exists; otherwise a simple server log/table):
  `intake_view`, `intake_started`, `step_completed {step, ms}`, `skip_to_claim`, `build_clicked {ms_total, own_products, has_logo}`, `domain_checked {status}`, `claim_clicked {domain}`, plus `variant: v1|v2` on every event.

### Acceptance
- Full flow works on a 360px-wide phone and desktop.
- Typing in any field updates the preview without page reload.
- Claim message opens WhatsApp with all fields filled.
- No string anywhere pitches `*.dukabee.co.ke` to sellers.

---

## Phase 2: Product page

### Routes
- Live stores: `/p/[slug]`.
- Intake preview: same component rendered as a view inside the phone frame (tap card → product view, back returns to grid with scroll position kept).

### Content (top to bottom)
1. Image area (swipeable if >1 image; placeholder tile if none, see Image slots).
2. Name, price; if `compareAtPrice` > price, show it struck through and a "-{n}%" badge.
3. Variant chips from `attributes` (e.g. size, colour). Selected variant goes into cart line and WhatsApp messages. If a variant group exists, require a selection before Add to cart (inline hint, no modal).
4. Short description (Portable Text / markdown later; plain text now).
5. Policy lines from store policies (delivery, payment, returns).
6. Quantity stepper + **Add to cart** (primary).
7. **Ask about this item on WhatsApp** (secondary):
   `wa.me/{seller}?text=Hi {shop}, is "{product}" ({variant}) available? {productUrl}`
8. Related products: same category, exclude self, up to 4; fall back to featured.

### SEO / agents
- `<title>{product} | {shop}`, meta description from description (first 155 chars).
- `Product` JSON-LD with `offers.priceCurrency: "KES"`, price, availability.
- Canonical URL on the store's own domain.

### Acceptance
- Every product card in grids, rails and showcases links to the product page.
- Sample products open a product page too (with the "Sample" tag visible).

---

## Phase 3: Store homepage formula (section vocabulary + recipes)

This is Kiwanda-style grammar applied to storefronts: a **closed vocabulary** of section types, **recipes** that order them, and **rules** that decide what renders. The homepage is data (an ordered list of sections), rendered by one component per section type.

### 3.1 Data model

```ts
type ID = string;

interface ImageRef {
  id: ID;
  src?: string;              // empty until image library exists
  alt: string;
  focal?: [number, number];  // 0–1, for cropping
  placeholder: { tint: string; glyph?: string }; // glyph = emoji/icon/initials
}

interface Category { id: ID; slug: string; name: string; parentId?: ID; image?: ImageRef }

interface Product {
  id: ID; slug: string; name: string;
  price: number;                  // KES, integer
  compareAtPrice?: number;        // shows as offer when > price
  offerEndsAt?: string;           // ISO; drives countdown
  categoryId: ID;
  images: ImageRef[];
  description?: string;
  attributes?: Record<string, string[]>; // { size: ["S","M"], colour: ["Black"] }
  featured?: boolean;
  bestseller?: boolean;           // manual until order data exists
  createdAt: string;              // ISO; drives "New"
  stock?: "in" | "low" | "out";
  sample?: boolean;               // demo filler shown in previews
}

type BannerTarget =
  | { type: "category"; id: ID }
  | { type: "product"; id: ID }
  | { type: "offer" }             // all products on offer
  | { type: "url"; href: string };

interface Banner {
  id: ID;
  kind: "hero" | "promo" | "offer";
  headline: string; sub?: string; cta: string;
  target: BannerTarget;
  image?: ImageRef;
  copySide: "left" | "right";     // where text sits; image focal stays clear
}

interface StoreConfig {
  name: string; domain?: string; previewId: string;
  niche: NicheId; recipe?: RecipeId;       // override niche default
  palette: { primary: string; accent: string };
  logo?: ImageRef; location?: string;
  policies: string[];
  whatsapp: string;                        // 2547XXXXXXXX
  announcement?: string;
  sections?: Section[];                    // explicit override; else generated
  checkout: CheckoutConfig;                // Phase 4
}
```

Migration: write a one-off script that upgrades the current JSON catalog to this shape (add `createdAt`, `slug`, `images` with placeholders, `categoryId`). Keep JSON as the source of truth until Phase 5.

### 3.2 Section vocabulary (closed set)

| type | variants | renders only if |
|---|---|---|
| `announcement` | static, marquee | `announcement` set |
| `hero` | `slider`, `banner`, `spotlight`, `split` (hero + 2 promo tiles) | slider: ≥2 hero banners; banner: 1; spotlight: ≥1 product; split: 1 hero + 2 promo banners |
| `categoryNav` | `circles` (with counts), `tiles`, `chips` | ≥3 categories with ≥1 product each |
| `productRail` | `grid`, `carousel`, `tabs` | source resolves to ≥4 products (tabs: every tab ≥4, else drop that tab; <2 tabs → render as grid) |
| `promoBanner` | `full`, `twoUp`, `threeUp` | each banner's target resolves (category ≥3 products, product exists, offer ≥1 product) |
| `offerCountdown` | `strip`, `block` | ≥1 product with `offerEndsAt` in the future |
| `trustStrip` | `icons` | ≥2 policies (generated from policy pills) |
| `productShowcase` | `left`, `right` | 1 product (featured first) |
| `socialProof` | `testimonials`, `feed` | content exists (later; skip for now) |
| `footer` | `standard` | always |

Product rail sources:
```ts
type RailSource =
  | "featured" | "new" | "bestseller" | "onOffer"
  | { category: ID }
  | { tabs: RailSource[] };
// "new" = createdAt within 30 days, else newest 8
```

```ts
interface Section {
  type: SectionType; variant: string;
  title?: string;               // e.g. "New arrivals"
  source?: RailSource;          // productRail
  bannerIds?: ID[];             // hero, promoBanner
  productId?: ID;               // productShowcase, spotlight
  minTier?: Tier;               // see 3.3
}
```

### 3.3 Catalog-size tiers

```
starter  = 1–8 products   (most seller previews)
growing  = 9–30
full     = 31+
```
Each recipe slot has a `minTier`; slots above the store's tier are dropped before rules run.

### 3.4 Recipes

Three recipes cover the 8 niches. Map the repo's 8 demo niches to these (expected: electronics, kitchen → marketplace; fashion, shoes, beauty → editorial; baby, fitness, home → playful).

**marketplace** (dense, Woodmart "mega electronics" feel)
1. announcement (growing)
2. hero `split` (growing) / `spotlight` (starter)
3. categoryNav `circles` (growing)
4. productRail `tabs` [new, bestseller, onOffer] (growing) / `grid` featured (starter)
5. promoBanner `twoUp` (growing)
6. offerCountdown `strip` (growing)
7. productRail `carousel` bestseller (full)
8. promoBanner `threeUp` (full)
9. productRail `grid` category:{largest} (full)
10. trustStrip
11. footer

**editorial** (big imagery, fewer products per row)
1. hero `slider` (growing) / `spotlight` (starter)
2. categoryNav `tiles` (growing)
3. productRail `grid` new (starter)
4. promoBanner `twoUp` (growing)
5. productShowcase `left` (growing)
6. productRail `carousel` bestseller (growing)
7. promoBanner `full` (full)
8. trustStrip
9. footer

**playful** (rounded tiles, warm, pets-demo feel)
1. hero `banner` (starter uses palette gradient, no image)
2. categoryNav `tiles` (growing)
3. productRail `carousel` featured (starter → `grid`)
4. promoBanner `threeUp` (growing)
5. announcement `marquee` (growing)
6. productRail `grid` bestseller (full)
7. offerCountdown `block` (growing)
8. trustStrip
9. footer

### 3.5 Composition rules (run after tier filtering, in order)

1. Drop any section whose "renders only if" condition fails.
2. `hero` must be first (after optional `announcement`); if dropped, promote `productShowcase` or the first rail to hero `spotlight`.
3. No two `productRail`s adjacent: if they are, move the next `promoBanner`/`productShowcase`/`trustStrip` between them; if none exists, drop the second rail.
4. No product appears in more than 2 sections on the page.
5. At most 1 `offerCountdown`, 1 `trustStrip`, 1 `announcement`.
6. `trustStrip` and `footer` always last, in that order.
7. Starter tier must render at least: hero, one product grid, trustStrip, footer.

Implement as a pure function with unit tests:
```ts
composeHomepage(store: StoreConfig, catalog: Catalog): Section[]
```
If `store.sections` is set, validate it with the same rules instead of generating.

### 3.6 Demo stores
- Expand each demo store's catalog to ~25–30 products across 4–6 categories so it reaches the `full` tier (placeholders for now).
- Add per-demo banners (hero ×3, promo ×3–4, offer ×1) with real copy and targets.
- Give some products `compareAtPrice` + `offerEndsAt` (rolling: always ~3 days ahead, computed at render so countdowns never expire).
- Mark 4–6 products `featured`, 4–6 `bestseller`.

### Acceptance
- `composeHomepage` unit tests cover: each tier × each recipe; banner with dead target dropped; adjacent rails separated; countdown hidden without offers.
- A seller preview with 3 own products + samples renders a clean starter page.
- Each demo store renders the full recipe.

---

## Phase 4: Pre-checkout presets

Replace/extend the existing pre-checkout form with a **closed field library** and **niche presets**. No form builder now; seller toggles come after claim; custom free-form fields are a later paid addon.

Size and colour are **product variants** (Phase 2), not checkout fields.

### Field library
```ts
type CheckoutFieldId =
  | "name"          // always on, required
  | "fulfilment"    // pickup | delivery; always on, required
  | "deliveryArea"  // shown when fulfilment = delivery; required then
  | "pickupPoint"   // shown when fulfilment = pickup; options from config
  | "deliveryDay"   // today | tomorrow | pick a date
  | "paymentMethod" // mpesa | cash_on_delivery (options filtered by store policies)
  | "notes"         // optional free text
  | "giftMessage";  // optional free text

interface CheckoutConfig {
  fields: CheckoutFieldId[];
  pickupPoints?: string[];
}
```

### Presets
| recipe/niche | extra fields beyond name + fulfilment (+ area/pickup) |
|---|---|
| fashion, shoes, beauty | paymentMethod, notes |
| electronics | paymentMethod, notes |
| kitchen, home | deliveryDay, paymentMethod, notes |
| baby | deliveryDay, giftMessage, notes |
| fitness | paymentMethod, notes |

Fulfilment options shown depend on policies: no "Pickup" without "Pickup point"; no delivery without a delivery policy (if neither, show both).

### WhatsApp order message
Generated from active fields only:
```
Hi {shop}, I'd like to order:
• {qty} × {product} ({variant}) ({lineTotal})
Total: KSh {total}
Name: {name}
{"I'll pick up at {pickupPoint}" | "Deliver to: {area}"}
Delivery day: {deliveryDay}
Payment: {paymentMethod}
Note: {notes}
```
Show the message as a preview bubble before opening `wa.me/{seller}`.

### Acceptance
- Each demo store uses its niche preset.
- Message omits lines for fields that are off or empty.

---

## Phase 5: EmDash on one demo store (Kladi / fashion demo first)

EmDash is beta. Verify everything below against current EmDash docs before building; stop and report if a step doesn't match.

### Architecture
- Introduce a catalog abstraction so stores can move one at a time:
  ```ts
  interface CatalogSource {
    getStore(): Promise<StoreConfig>;
    listProducts(q?: { categoryId?: ID; search?: string }): Promise<Product[]>;
    getProduct(slug: string): Promise<Product | null>;
    listCategories(): Promise<Category[]>;
    listBanners(): Promise<Banner[]>;
  }
  ```
  Implementations: `JsonCatalogSource` (current), `EmDashCatalogSource` (new). All rendering (homepage composer, product page, checkout) goes through `CatalogSource` only.
- EmDash collections mirror the Phase 3 data model: `products`, `categories`, `banners`, `store_settings` (single entry), optionally `homepage_sections`.
- Database: SQLite on Node, or D1 on Cloudflare, whichever matches current hosting.

### Seed / export
- `scripts/emdash-seed.ts`: reads the store's JSON catalog → upserts EmDash collections (idempotent, keyed by `id`).
- `scripts/emdash-export.ts`: EmDash → JSON in the same shape (for versioning and resets).

### Demo login
- One shared demo editor account per demo store, credentials shown on the demo store's "Edit this store" page.
- Nightly reset: wipe and reseed from the JSON seed (cron / scheduled job).
- Banner in the admin and on the storefront while logged in: "This is a demo. Changes reset every night."
- Storefront reflects edits without a rebuild (EmDash live collections).

### Open checks to report back on
- Can one deployment serve multiple stores, or is it one deployment per store? Don't build multi-tenancy; just report.
- Plugin sandboxing requirements on the chosen host.
- How media uploads are stored (needed for Phase 6).

### Acceptance
- Kladi demo renders identically from `JsonCatalogSource` and `EmDashCatalogSource` (snapshot test).
- Demo editor can change a product name/price and see it on the storefront.
- Reset restores the seed.

---

## Image slots (applies now, before images exist)

- Every image in data is an `ImageRef`. With no `src`, render the placeholder: `tint` background + `glyph` (niche emoji/icon or category initials).
- Product tiles: square (1:1), `object-fit: cover`, respect `focal`.
- Banners: never bake text into images. Without an image, render a palette gradient (primary → accent) with headline/CTA on `copySide`.
- Category images: circle/tile placeholders using category initial on tint.
- Swapping in real images later must require only setting `src` (and optionally `focal`) in data. No component changes.

---

## Phase 6 (later, after Phases 1–5): Image library

Spec only; don't build yet.

- Per niche: 25–30 product shots, 3 hero banners, 3–4 promo banners, 1 offer banner, 1 image per category (~40 per niche, ~330 total).
- Product images: 1:1, 1200px, same neutral backdrop across the library, WebP.
- Banners: no text, desktop wide crop + mobile 4:5 crop (or a documented safe zone), known copy side.
- No real brand logos on demo products.
- Index (`library/index.json`):
  ```ts
  interface LibraryImage {
    id: ID; niche: NicheId; category?: string;
    type: "product" | "banner" | "category" | "lifestyle";
    tags: string[]; src: string; srcMobile?: string;
    focal: [number, number]; copySide?: "left" | "right";
    dominantColour: string;
    source: "generated" | "stock" | "supplier" | "own"; licence: string;
  }
  ```
- Demo catalogs reference library ids; the intake picks banner images by niche + palette compatibility.

---

## Config values to confirm with Mbogo

- `DUKABEE_WA`: WhatsApp number that receives claims.
- Pricing copy (KSh 10,000 first year incl. domain + hosting; KSh 5,000/year renewal).
- Enabled domain suffixes (`co.ke`, `.ke`?).
- The 8 demo niches and their recipe mapping, if different from Phase 3.4.
