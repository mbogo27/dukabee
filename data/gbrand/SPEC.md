# GBRAND store: Duka Bee build spec

> **v1.2:** see `CHANGES-v1.2.md` for content width, hero layout, article layout, WhatsApp join and the admin. It overrides this file where they differ.

Version 1.1 · 18 Oct 2026 · Prepared for Claude Code

**Changes in 1.1:** every kit is KSh 1,499; the pair deal is KSh 2,998; club crests are added wherever a team is named; the sale state and the "On offer" filter are removed.

## 1. What we're building

A Duka Bee store for **GBRAND**, a Kenyan apparel brand ("Wear your legacy") that sells club football jerseys now and accessories later. Buyers browse, pick a size (and optional name and number print), and send the order to GBRAND on WhatsApp. Payment is M-Pesa after GBRAND confirms stock and the delivery fee.

The visual and behavioural reference is `prototype/gbrand-preview.html`. Open it on a phone first, since most buyers will. **Match it.** Where this spec and the prototype disagree, this spec wins.

Scope:
- Core Duka Bee commerce: home, shop, product page, cart overlay with WhatsApp pre-checkout.
- Client extras beyond the core MVP: **Brand page** (`/brand`) and **Magazine** (`/magazine`, `/magazine/[slug]`). These are add-on scope for this client and must not change the core store template.

## 2. Stack

- **Astro** (static output), consistent with other Duka Bee stores.
- **Catalog:** static JSON in `data/` (`store.json`, `products.json`, `clubs.json`), loaded at build time. Keep the shape so the Catalog Manager can write to it later.
- **Magazine:** Markdown posts in `content/magazine/*.md` as an Astro content collection. If the EmDash CMS integration is already wired into the Duka Bee store template, map this collection to EmDash instead. Keep the frontmatter fields identical either way.
- **Client JS:** only for the cart, size picker, print option, filters, quick-add sheet and the hero marquee. Use small vanilla modules or Astro islands with no heavy framework. The cart persists in `localStorage` (wrapped in try/catch) so a refresh doesn't empty the bag.
- **Fonts:** Google Fonts `Big Shoulders Display` (600, 800, 900) and `Archivo` (variable `wdth 62..125`, `wght 400..800`), with `display=swap` and the fallbacks in `store.json`. Self-host if the template already does.

## 3. Routes

| Route | Purpose |
| --- | --- |
| `/` | Homepage (block list in `store.json → homepage`) |
| `/shop` | All products. Filters are **query params, not routes**: `?club=arsenal&type=Retro&sale=1&q=green&sort=low` |
| `/product/[slug]` | Product page, one per item in `products.json` |
| `/brand` | Brand story, promises, how to order, contact |
| `/magazine` | Magazine index: masthead, category chips, featured post, grid |
| `/magazine/[slug]` | Article, with a "Shop the story" strip from `relatedProducts` |
| `/404` | On-brand not-found page with links to Shop and Magazine |

There are no category or club pages, following the Duka Bee rule. Header "Clubs" goes to `/shop` and scrolls to the club chips.

## 4. Design system (sport preset)

Tokens live in `store.json → theme`. Expose them as CSS custom properties on `:root`.

- **Type.** Display: Big Shoulders Display, uppercase, tight leading (0.84–0.92). Body: Archivo 15–17px. Labels, eyebrows, buttons and prices use Archivo at `font-stretch: 72–85%`, uppercase, letter-spacing 0.08–0.16em.
- **Colour.** Chalk page, white cards, ink (`#121212`) bands for the hero and footer. Kenya red `#b81f2b` for CTAs, sale prices and eyebrows. Kenya green `#0c6b3b` for WhatsApp, the ticker, success states and the join band.
- **Shape.** Square corners everywhere (`radius: 0`). Borders are 1–1.5px `--line`.
- **Brand device.** The **Kenya flag stripe**, a 12px bar of black, white, red, white and green bands. Use it under the header, under the brand hero and at the very bottom of the footer. Nowhere else.
- **Club crests.** Every place a team is named shows its crest from `assets/clubs/{club}.svg` (mapped in `clubs.json → crest`):
  - club tiles at 58px
  - shop club chips and the menu at 20px
  - product card club label at 16px
  - product page and spotlight eyebrow at 34px
  - filtered shop heading at the cap height of the H1

  Render them with `<img>` (not inlined SVG) so gradient and filter IDs inside the files can't collide. Use `object-fit: contain`, and never recolour or crop them.
- **Kit number.** Every product shows `No.XX` (its catalogue number, `sku` minus prefix) in an ink tag on the image's top-left corner. Badges sit top-right: green "New". There is no sale badge while all kits share one price; keep the component for later.
- **Images.** Product images are 4:5 everywhere. They are already normalized (see section 9), so use `object-fit: cover`.
- **Logo.** Use `logo.png` on light grounds and `logo-white.png` on ink grounds. Header logo height is 46px. Never recolour or stretch it.
- **Motion.** The hero kit wall marquee (three rows behind the hero copy, alternating directions, rotated −4°), card image zoom on hover, and drawer and sheet slides. All of it is disabled under `prefers-reduced-motion`.

## 5. Homepage blocks (in order)

All copy and props are in `store.json → homepage`.

1. **Ticker.** A green announcement strip that scrolls the `announcements`.
2. **Header.** Sticky. Logo, nav, search (goes to `/shop` and focuses the search box), WhatsApp icon, bag with count. On phones: burger, logo, bag. The flag stripe sits under it.
3. **`hero.kitWall`.** Ink band. "WEAR YOUR / LEGACY" with LEGACY in outline (`-webkit-text-stroke`, solid red fallback). Body, two CTAs, three stats: kit count and club count (computed) and "1,499 · KSh, every kit". The kit wall is the hero **background**, not a separate strip: three marquee rows of product cards with `No.XX` tags, absolutely positioned behind the copy, rotated −4°, full width, at about 42% opacity on phones and 55% on desktop. An ink gradient overlay keeps the text readable (heavier on the left from 900px up, heavier top to bottom on phones). Desktop hero is at least 640px tall with the copy vertically centred.
4. **`categories.clubTiles`.** One tile per club in `clubs.json`: crest (tilts slightly on hover), club name and kit count, with a two-colour club stripe on the left edge (from `colors`). Tap goes to `/shop?club=slug`. Show only clubs that have stock.
5. **`products.grid`.** "New this week", the newest 8.
6. **`promo.pairBundle`.** Red band. "Double up / Any 2 kits KSh 2,998 / Every kit is KSh 1,499. Grab two and mix clubs, sizes and styles." with two tilted product images and a "+" disc.
7. **`product.spotlight`.** "Kit of the week" (the `featured: true` product) with an inline size picker and Add to bag.
8. **`brand.teaser`.** Logo plus short story, linking to `/brand`.
9. **`magazine.latest`.** The latest 3 posts.
10. **`trust.strip`.** Four cells.
11. **`join.whatsapp`.** Green band with a phone input. For now, submitting shows a confirmation toast only. Log the event (section 8) and do not post anywhere until a list provider is chosen.
12. **Footer.** Ink band with the white logo, Shop / GBRAND / Contact columns, payment marks and a final flag stripe.
13. **Mobile bottom bar** (under 900px): Home, Shop, Magazine, Bag.

## 6. Shop and product

### Product card
Image, `No.XX`, badge, crest + club · kit type, name, price. The sale-price styling (red price plus struck-through old price) stays in the component for future use. A **Quick add** button opens a bottom sheet with a size picker. A size is required, and the sheet links to the product page for printing.

### Shop page
Heading (changes to the crest and club name, or the type, when filtered), search (matches name, club, type and description), club chips with crest and count, type chips, a sort select (Featured, Newest, Club A–Z) and a result count. There are no price sorts or "On offer" filter while every kit is one price. All filter state syncs to the URL query string. The grid ends with the **"Accessories landing soon"** card linking to WhatsApp, until accessory products exist.

### Product page
- Breadcrumb, then the image (sticky on desktop) and the info column.
- Eyebrow (crest + club · type), name, price, description.
- **Size picker** S–XL–XXL, required. The inline error is "Pick a size first."
- **Name & number print.** A toggle at +KSh 500. Name is at most 12 characters (letters, space, `' . -`) and is uppercased. Number is 0–99, digits only. A **back-print preview** (ink block, name over a big number) updates live. If printing is on, both fields are required.
- A quantity stepper (1–10) and **Add to bag · {live total}**.
- **Order this on WhatsApp** sends a one-item message straight to GBRAND. It requires a size.
- Accordions: Size guide (table from `store.json`), Delivery & payment, Care.
- "You might also like": same club first, then others, 4 items.

### Cart overlay (no cart page)
A drawer opens from the bag icon.
- **Bag step.** Lines show thumb, name, size, print and the +fee if any, unit price, qty stepper and remove. Lines are unique by `slug + size + print`.
- **Pair deal.** Sort every jersey unit by base price (excluding the print fee) from high to low, then pair them in order. Each pair's discount is `max(0, a + b − pairPrice)`, with `pairPrice` = 2,998. At today's KSh 1,499 per kit the discount is always 0, so no discount line shows. Keep the logic so a lower `pairPrice` works without code changes, and show any non-zero discount as a green "Pair deal −KSh X" line. With one unit in the bag, nudge: "Add one more kit and pay KSh 2,998 for the pair."
- Subtotal, discount, Total, and "Delivery fee confirmed on WhatsApp."
- **Details step.** Name, Phone, Delivery pills (Delivery in Nairobi, Pickup, Courier upcountry), Town or estate, and a **live message preview** using `checkout.messageTemplate`.
- **Send order on WhatsApp** opens `https://wa.me/254794790575?text=…`. Record the order (section 8) *before* opening WhatsApp, so the lead exists even if they don't hit send. Generate an order reference (`GB-YYMMDD-XXXX`) and add it to the first line of the message.

## 7. Brand page and Magazine

**`/brand`.** Ink hero with the white logo, "Wear your legacy" and an intro, then the flag stripe. "Three promises" (Shot in hand, Sizes that fit, All of Kenya). "How to order" as four numbered steps; the numbering is real because it's a sequence. A contact card shows the phone as selectable text with a Copy button (wrap `navigator.clipboard` in try/catch and select the text as fallback) plus a WhatsApp button. The copy here is a placeholder until the owner gives his real story (section 11).

**`/magazine`.** A masthead with "GBRAND Magazine" eyebrow, a huge "THE LEGACY" and an issue line ("Issue 01 · October 2026", computed from the latest post date). Category chips (All, Guides, Kits, Style), a featured post (latest), then a 3-column grid.

**`/magazine/[slug]`.** Breadcrumb; meta (category, date, reading time, "By the GBRAND team"); H1, lede, a 16:10 cover and the prose body at max 760px. Style blockquotes as a red left rule with display type. Tables use the size-guide styling. "Shop the story" shows a 3-product strip, then "More from The Legacy." Internal links already point to the production routes (`/product/…`, `/magazine/…`).

Four posts are seeded in `content/magazine/`. Posts must be addable without code changes.

## 8. Data, events and SEO

### Order record
Write it to the Duka Bee order log, or `POST /api/orders` if this store has no backend yet; stub that endpoint and log the payload to the console so it can be wired later:

```
Order { ref, createdAt, lines:[{slug, sku, size, print:{name,number}|null, qty, unitPrice}], subtotal, discount, total, customer:{name, phone, fulfilment, location}, source:"web", refCode? }
```

Carry an optional `?ref=` code from the landing URL in sessionStorage and add it to the order (affiliate attribution).

### Events
`view_item`, `quick_add_open`, `select_size`, `toggle_print`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `whatsapp_handoff` (with `ref` and `total`), `filter_shop`, `search`, `join_submit`, `read_post`. Fire them through one `track()` helper so the analytics provider can be swapped.

### SEO
- Titles use `store.json → seo.titleTemplate`, with unique meta descriptions per product and post.
- Product pages carry `Product` JSON-LD: name, image, sku, brand "GBRAND", and offers with KES price, `InStock` and the url.
- Posts carry `Article` JSON-LD. Generate `sitemap.xml` and `robots.txt`.
- OG and Twitter cards: the product image on product pages, the post cover on posts.
- Alt text is the product name. Decorative images get `alt=""`.

### Performance and accessibility
- LCP image is the first hero card; preload it. Lazy-load everything else, and set explicit `width` and `height` (800×1000).
- Target Lighthouse mobile ≥ 90 for Performance and ≥ 95 for Accessibility.
- Visible focus states. Drawers and the sheet trap focus and close on Esc and on scrim tap. Every form control has a label.
- No horizontal scroll at 360px. Respect safe-area insets on the sticky header and bottom bar.

## 9. Assets (already cleaned)

```
assets/products/{slug}.webp            800×1000, 4:5, client photo centred on a blurred fill of itself (use everywhere)
assets/products/{slug}-thumb.webp      400×500, for cart lines, sheets and minis
assets/products/{slug}-original.jpg    cleaned original (auto-levels, light sharpen), max 1600px; zoom / future gallery
assets/brand/logo.png                  transparent, trimmed, for light backgrounds
assets/brand/logo-white.png            transparent, ink converted to white, flag colours kept; for dark backgrounds
assets/brand/logo-original.jpg         the client's file as received
assets/clubs/{club}.svg                club crests supplied by GBRAND, cleaned (metadata and comments stripped, missing viewBox added to man-united)
```

Each product has one photo, so there's no gallery for now. The data model allows `images` to grow into an array later.

A favicon is **not** provided. The wordmark is unreadable at 32px. Generate a simple square "G." in Big Shoulders Display 900 (white on ink) with a thin flag stripe at the bottom, at 32, 192 and 512, plus an apple-touch icon.

## 10. Acceptance checklist

- [ ] On a 390px phone, home → club tile → filtered shop → product → size → print → add → bag → details → WhatsApp works without dead ends.
- [ ] The WhatsApp message matches the template exactly, including order ref, sizes, prints, discount and total.
- [ ] Prices: every product shows KSh 1,499, and two kits total KSh 2,998 with no discount line. Set `pairPrice` to 2,500 temporarily: the bag shows "Pair deal −KSh 498". Three kits pair the two most expensive, and no discount is ever negative.
- [ ] Crests appear on club tiles, chips, cards, product and spotlight eyebrows and the filtered shop heading, with no ID clashes or distortion.
- [ ] The cart survives a page refresh.
- [ ] Filters are reflected in the URL and restored from a shared link.
- [ ] A new `.md` post appears on `/magazine` and gets its own page with no code change.
- [ ] A new product added to `products.json` appears everywhere (grid, club counts, hero stats, shop) with no code change.
- [ ] Pages pass the Lighthouse targets, and the visual match against the prototype is checked side by side.

## 11. To confirm with GBRAND before launch

These are placeholders in the data. **Do not ship them as fact.**

1. **Prices.** Every kit is KSh 1,499 (confirmed).
2. **Offers.** The pair deal is KSh 2,998 (confirmed). That equals two kits at KSh 1,499, so it saves the buyer nothing. Confirm GBRAND is happy presenting it that way, or set a lower pair price. Also confirm whether name and number printing (+KSh 500) is offered and at what price.
3. **Sizes.** Is every kit really available in S–XXL? Are they fan or player cut? Adjust the size guide to his actual garments.
4. **Policies.** Size swap terms, delivery options and fees, whether cash on delivery is available, and business hours.
5. **Story.** The brand page copy is generic. Get his real story, location (shop or online only) and social handles.
6. **Accessories.** What he stocks, with photos, to replace the "coming soon" card.
7. **Domain.** The `.co.ke` name to register through Truehost.
8. **Product names.** Confirm names and kit types (the Chelsea black kits and the Arsenal navy were named from the photos).
9. **Trademarks.** The kits, and now the site's crests, show club and Nike/Adidas/Puma trademarks. Unless GBRAND sells licensed stock, avoid words like "official", "original" or "authentic" anywhere in the copy, and expect Meta and Google to reject ads that show these marks.
