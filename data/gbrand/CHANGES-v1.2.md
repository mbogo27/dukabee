# GBRAND v1.2 change spec

These are changes to apply to the store **already built from SPEC.md v1.1**. Work through the sections in order. `prototype/gbrand-preview.html` has been updated to match sections 1–4, so use it as the visual reference. Where this file and SPEC.md disagree, this file wins.

Summary:

1. Content width: 80% of the viewport on desktop, not full bleed.
2. Hero: fill the empty right side. Use the split layout by default and support a centred variant.
3. Magazine article: use the full content width, with a sticky sidebar.
4. Join block: replace the phone-number form with a "Join on WhatsApp" button.
5. Admin: add a Catalog manager and a Post manager with a WYSIWYG editor.
6. Preview mode, used when the store is served as a preview.
7. Acceptance checklist additions.

---

## 1. Content width

**Problem.** On desktop the content runs almost edge to edge, which makes the page look stretched.

**Change.** Use one container token for every section: header, hero copy, all homepage blocks, shop, product, brand, magazine, footer.

```css
:root { --wrap: 100%; --gutter: max(16px, env(safe-area-inset-left)); --gutter-r: max(16px, env(safe-area-inset-right)); }
@media (min-width: 900px)  { :root { --wrap: 90vw; } }
@media (min-width: 1200px) { :root { --wrap: min(80vw, 1360px); } }
.wrap { width: 100%; max-width: var(--wrap); margin-inline: auto; padding-inline: var(--gutter) var(--gutter-r); }
```

| Viewport | Content width |
| --- | --- |
| < 900px | Full width minus 16px gutters (unchanged) |
| 900–1199px | 90vw |
| ≥ 1200px | 80vw, capped at 1360px (1152px at 1440, 1360px at 1920) |

Rules:
- **Full-bleed backgrounds stay full bleed.** The ink hero, red pair band, green join band, footer and ticker still span the viewport. Only their *inner content* sits in `.wrap`.
- The header logo and icons line up with the content edges, not the viewport edges.
- Product grids keep 4 columns at ≥ 1200px. Don't add a 5th column to fill space.
- No section sets its own max-width except the text measures in section 3. Remove any `max-width: 760px`-style containers left over from v1.1.

## 2. Hero: fill the right side

**Problem.** On desktop, the left-aligned copy leaves dead space on the right even with the kit wall behind it.

The kit wall background stays as it is: three marquee rows, rotated −4°, behind an ink overlay. Two layouts are supported, chosen with a prop:

```json
{ "block": "hero.kitWall", "props": { "layout": "split", "...": "unchanged" } }
```

### 2a. `layout: "split"` (default)

From 1000px up, use a two-column grid: copy on the left (`7fr`), a **"Just dropped" card stack** on the right (`5fr`), gap 48px, both vertically centred. The hero is at least 640px tall.

- **Copy column.** H1 at `clamp(64px, 6.4vw, 118px)`, so "WEAR YOUR" fits on one line and LEGACY sits on the second. Body, CTAs and stats are unchanged.
- **Card stack.** Three product cards, 4:5, 480px tall:
  - Front: the newest product by `added`, excluding the homepage spotlight product so the two don't repeat. It has a 6px white frame, a red "Just dropped" tag at the top left, and a white bottom bar with the name (display type) and price. The whole card links to the product page.
  - Behind: the next two newest products, one rotated −7° to the left and one +6° to the right, at 90% opacity with a soft drop shadow.
  - The stack is static. The wall behind it already moves, so don't animate the stack as well.
- **Overlay.** A left-to-right ink gradient: `var(--ink)` at 0 → 0.9 at 32% → 0.55 at 62% → 0.4 at the right edge. Add a bottom fade into the next section.
- **Below 1000px.** Hide the stack. The layout is unchanged from v1.1, with copy on top and the wall behind it.

### 2b. `layout: "center"`

The copy is centred in a single column: eyebrow, H1 at `clamp(80px, 10.5vw, 184px)` with "WEAR YOUR" on one line, then body (max 44ch), CTAs and stats, all centred. There is no stack. Use a radial overlay that's darkest behind the text (`radial-gradient(60% 75% at 50% 50%, ink .92, ink .6 70%, ink .4)`), so the wall shows at the edges.

**Recommendation.** Use `split`. It puts a real product and price above the fold, which is what the empty space was missing. `center` is the cleaner, more editorial option. GBRAND can choose; it's a one-value change. To compare them in the prototype, open it with `?hero=center` added to the URL.

## 3. Magazine article: full content width

**Problem.** Articles sit in a narrow 760px column, which makes them look like a different site.

**Change.** The article page uses the same `.wrap` as every other page:

1. Breadcrumb, meta, then the **header block** (H1 and lede) at max 1000px, left-aligned.
2. **Cover** at full content width: 21:9 from 900px up, 16:10 on phones.
3. A **body grid** from 1100px up: `minmax(0,1fr) 340px`, gap 64px.
   - Left: the prose, with the *text* measure capped at **72ch** (about 680–720px). Full-width text lines are hard to read, so the extra width goes to the sidebar instead. Tables and images inside the prose may use the full left column.
   - Right: a **sticky sidebar** (`top: 120px`) with:
     - "In this guide": a table of contents built from the post's H2s, with smooth scroll and a 110px offset for the sticky header. Show it only when the post has 2 or more H2s.
     - "Shop the story": products from `relatedProducts`, in a 2-column mini grid.
     - "Ask us on WhatsApp": a green button with a prefilled message: `Hi GBRAND, I just read "<post title>". `
4. Below 1100px it's a single column: prose, then the sidebar content stacked underneath.
5. "More from The Legacy" (3 cards) stays below, at full content width.

## 4. Join block: how "Join on WhatsApp" works

**Problem.** v1.1 had a phone input that showed a toast and saved nothing, so numbers went nowhere.

**v1.2 behaviour (no backend, ships now):**
- Remove the phone input. Show one white button: **"Join drop alerts on WhatsApp"**, with the small line "Opens WhatsApp with a message ready to send. Reply STOP any time to leave."
- The button opens `https://wa.me/254794790575?text=` with the message `Hi GBRAND, add me to new kit alerts. (Reply STOP anytime to leave.)`
- The customer sends the message themselves, which gives clear opt-in and puts their number in GBRAND's WhatsApp Business chats. GBRAND labels the chat **"Drop alerts"** in WhatsApp Business.
- Log `join_click` (rename from `join_submit`).

**How GBRAND sends the alerts (operations, not code):**
- **WhatsApp Business broadcast list** of everyone labelled "Drop alerts". Broadcasts only reach people who have saved GBRAND's number. So the auto-reply to the join message should say: *"You're in! Save this number as GBRAND so our drop alerts reach you."*
- Optionally, a **WhatsApp Channel** for GBRAND. If one exists, add `contact.whatsappChannel` to `store.json` and show a secondary link, "Or follow our WhatsApp Channel". It has no list limits and needs no saved number.

**v2 (later, needs backend; don't build now):** Save opted-in numbers to a Subscribers list in admin and send template messages through the WhatsApp Business Cloud API. Marketing templates need Meta approval and each send is charged. Leave this as a §11 decision.

Update `store.json`:
```json
{ "block": "join.whatsapp", "props": { "title": "New kits first", "body": "Get drop alerts and restocks on WhatsApp. No spam, just kits.", "button": "Join drop alerts on WhatsApp", "message": "Hi GBRAND, add me to new kit alerts. (Reply STOP anytime to leave.)", "note": "Opens WhatsApp with a message ready to send. Reply STOP any time to leave." } }
```

## 5. Admin: Catalog manager and Post manager

GBRAND must be able to run the store without a developer. **If the Duka Bee template already has an admin or EmDash wired in, build these screens there and map them onto the existing data shapes.** The requirements below are the acceptance bar either way. Don't change the shapes of `products.json`, `clubs.json`, `store.json` or the magazine frontmatter. The admin writes the same files the site already builds from.

### 5.0 Shared

- **Location.** `/admin` on the store domain, kept out of the static site's sitemap, with `noindex` set.
- **Login.** Email magic link or WhatsApp/SMS OTP. Use whichever Duka Bee already has. Two roles:
  - **Owner:** everything.
  - **Editor:** posts only.
- **Publishing model.** Saving writes the source data (a commit to the store repo, or the Duka Bee content store), then triggers a rebuild via the deploy hook. Show the state: *Saved → Publishing… → Live* (target under 2 minutes), plus a "View on site" link. Drafts never trigger a rebuild.
- **Mobile first.** GBRAND will mostly use this on a phone. Every screen must work at 390px. Use large tap targets and bottom-sheet pickers.
- **Images.** On upload, generate the same outputs as `assets/products/`: a 4:5 card at 800×1000 webp, a thumb, and the stored original. Fill non-4:5 photos with a blurred backdrop and never crop the garment. Show a live 4:5 preview before saving.
- **Audit.** Record who changed what and when for each item (a simple list is enough).

### 5.1 Catalog manager

**Products list.**
- Search by name.
- Filters by club, type and status (Live, Draft, Sold out).
- Each row shows the thumb, name, club crest, kit number, price and status.
- Drag to reorder the "Featured" sort.
- Bulk actions: set status, set price.

**Product editor.** Its fields map 1:1 to `products.json`:

| Field | Control |
| --- | --- |
| Name | Text, required |
| Slug | Generated from the name and editable. It locks once the product is live; after that, renaming shows a warning and adds a redirect |
| Club | Picker showing crests, from `clubs.json` |
| Kit type | Pills: Home / Away / Third / Retro / Special |
| Kit No. | Auto-assigned and editable |
| Price | Number in KSh, defaults to the store standard (1,499) |
| Compare-at price | Optional; when set, the product shows the sale styling |
| Sizes | Toggle per size (S–XXL): in stock or out. All out = Sold out |
| Printing allowed | Toggle |
| Description | Short rich text: bold, italic, list |
| Photos | 1–6, drag to order; the first is the card image |
| Tags | "New" (auto for 14 days after `added`), "Featured" (the homepage spotlight; only one at a time) |
| Status | Draft / Live / Archived |

The **clubs** screen lets the owner add or edit a club: name, two stripe colours (with a contrast check against white text), and a crest upload (SVG or PNG, auto-trimmed, shown on a light background).

**Store settings** (owner only) edit `store.json`:
- standard price, pair-deal price and on/off, print fee
- ticker announcements (reorderable list)
- hero layout (`split` / `center`)
- the homepage spotlight product
- WhatsApp number and hours
- delivery options

### 5.2 Post manager

**Posts list.**
- Shows title, category, status (Draft / Scheduled / Published), date and author.
- Filter by category.
- Actions: duplicate, unpublish.

**Post editor (WYSIWYG).** Use a block editor with a toolbar. Tiptap or the EmDash editor are both fine; pick whichever the template already ships. It must save to the existing Markdown and frontmatter, so the build is unchanged.

| Block | Saves as |
| --- | --- |
| Paragraph with **bold**, *italic*, link | Markdown |
| Heading (H2, H3 only; the H1 is the title field) | `##`, `###` (H2s feed the "In this guide" contents) |
| Bulleted and numbered list | Markdown lists |
| Quote | `>`, rendered as the red-rule display quote |
| Image, with alt text required and an optional caption | Uploaded with the same processing; Markdown image |
| Table (add/remove rows and columns) | Markdown table |
| **Product embed:** pick products from the catalog | Appended to `relatedProducts`, so they appear in "Shop the story" |
| **WhatsApp button** with a custom message | A shortcode the renderer turns into the green wa.me button |

**Side panel fields:**
- **Cover image:** 16:10 crop picker that also shows the 21:9 crop.
- **Category:** Guides / Kits / Style / News, editable list.
- **Excerpt or lede:** required, 160 characters max. It is also the meta description.
- **Slug:** locks once published.
- **Publish date:** a future date means Scheduled; the rebuild fires at that time.
- **Reading time:** calculated automatically.
- **Featured on the magazine index:** toggle, one post at a time.
- **SEO title:** optional override.

**Preview:** a button that opens the draft rendered in the real article layout, at desktop and phone width, before publishing.

### 5.3 Out of scope for v1.2

Orders (they live in WhatsApp), customer accounts, inventory counts per size (in or out is enough for now), and analytics dashboards (use the events from SPEC §8).

## 6. Preview mode

The client preview is served at `dukabee.co.ke/preview/gbrand-<random>` and the live store at `gbrand.dukabee.co.ke`, later moving to GBRAND's own domain. Both are built from one codebase, with `PREVIEW=1` set for the preview build:

- `noindex, nofollow` meta plus an `X-Robots-Tag` header. No sitemap.
- A slim ink ribbon above the ticker: "Preview of your Duka Bee store · Ordering is off". The checkout button reads "Ordering opens at launch" and doesn't open WhatsApp.
- All asset paths are relative to the base path, so the build works under `/preview/gbrand-xxxx/`.
- The preview expires after 30 days (the route returns 410).

## 7. Acceptance checklist additions (append to SPEC §10)

- [ ] At 1440px, content is 1152px wide and centred. At 1920px it is 1360px. The hero, pair band, join band and footer backgrounds are still full bleed.
- [ ] At 390px, nothing scrolls horizontally on Home, Shop, Product, Brand, Magazine or Article.
- [ ] With the `split` hero at ≥ 1000px, the "Just dropped" stack fills the right column and its front card links to the product. With `center`, the copy is centred and there is no stack.
- [ ] Article pages use the full content width, the prose lines are 72ch or less, the sidebar is sticky, and the TOC scrolls to each H2.
- [ ] The join button opens WhatsApp with the opt-in message, and `join_click` is logged.
- [ ] In admin, creating a product with a photo and publishing it makes it appear in the shop within 2 minutes, with a correct 4:5 card image.
- [ ] In admin, a post created with headings, a table, an image and a product embed renders with the TOC and "Shop the story" filled.
- [ ] An Editor can't open the Catalog manager or Store settings.
- [ ] In a preview build, `noindex` is set, ordering is disabled and the ribbon shows.
