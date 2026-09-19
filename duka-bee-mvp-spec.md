# Duka Bee MVP — Preview-First Launch Flow

**Status:** Spec for current build update
**Goal:** Ship an interactive "launch your store" flow where the store preview itself is the pitch — no signup wall, no payment gate before the seller sees their store.

---

## 1. Core flow

Four screens, kept visibly short so the progress indicator reads as "almost there," not "step 6 of 11":

1. **Brand**
2. **Details**
3. **Catalog**
4. **Preview**

### Step 1 — Brand
- Logo upload (image).
- If no logo:
  - Option A — **Brand Kit**: quick prompts (primary color, style/vibe, optional wordmark text) to generate a light brand identity.
  - Option B — **Generic Brand**: falls back to a default `brand.md` (Duka Bee house style), zero input required.

### Step 2 — Details
- Store description (short, 1–2 lines)
- Contact details (phone/WhatsApp)
- Physical / pickup location
- Delivery & returns policy (short text or preset options: "pickup only," "delivery within Nairobi," etc.)

### Step 3 — Catalog
- 3–5 products: name, price, photo, short description, category, one flexible attribute (size/color/brand — niche-dependent).
- **Seed from dummy data**: seller can pick a niche template (see §2) to pre-fill the catalog instantly.
- Dummy data is fully editable and expandable before submission — swap products, adjust prices, add up to the 5-product cap.

### Step 4 — Preview
- Renders the live store: browsable, with working search and category/attribute filters (this is the showcase moment — it has to feel real, not like a static mockup).
- CTA sits here (see §4).

**Design note on step count:** each screen should ask for genuinely one thing (brand OR details OR catalog), not be subdivided further into one-field-per-screen. A 4-step bar that fills steadily feels fast; an 8–11 step bar for the same content feels like a chore, even though the total input hasn't changed.

---

## 2. Dummy data niches

Seed catalogs to build out (round set of 8, covers a useful spread of price points and product types):

- Electronics
- Cosmetics
- Kitchen utensils
- Gym / fitness
- Baby store
- Clothing / fashion
- Phone accessories
- Food / pantry

Each niche template: 5 products with name, price, photo, category tag, and one attribute field populated (e.g., size for clothing, capacity for kitchenware).

---

## 3. Search & filters

Kept deliberately generic so the same logic works across every niche without custom filter code per category:

- **Search:** matches product name + category.
- **Filters:** category, price range, and the one flexible attribute field per product.

---

## 4. CTA — intent capture, not payment

**Removed:** direct "Claim & Publish for KSh 10,000" payment button.

**Replaced with:** a real, clickable CTA that captures intent without processing payment yet.

- Button: something like *"I want this store"* / *"Activate my store."*
- Opens a lightweight form: name, phone/WhatsApp, preferred store name (if different from draft), best time to reach them.
- On submit: confirmation message — store request received, activation is KSh 10,000 (domain + hosting included), someone will follow up to complete it.
- Submission is a real, working action (saved to a leads list/table), not a stub — the difference from a payment CTA is only *what happens after the click*, not whether the click does anything.
- **Soft upsell:** addon bundles mentioned near the CTA, visually secondary — a line or small toggle, not a competing button. It should never pull attention away from the single primary action.

**Fork-in-the-road note (why intent capture, not payment, for this ship):**
The intake → live preview pipeline is the same manual-form + brand-render pipeline already scoped — fully shippable today. Live payment (M-Pesa STK push) plus the logic that promotes a paid store from preview to its own live subdomain is a separate, riskier piece. Splitting them means today's test (with Kipruto) validates the part that actually matters first — does the store look right, is it fast, do search/filters work, does the flow feel quick — without today's deploy depending on payment infrastructure being correct on the first try. Payment goes in as a fast-follow once the intake/preview survives a live test outside your own head.

---

## 5. Deployment & access model

- Wildcard DNS (`*.dukabee.co.ke`) → single app; no per-store DNS work.
- Demo/dummy-seeded stores are openly browsable — they *are* the preview/showcase layer.
- Real seller stores: intent captured now, paid store promotion (own subdomain, unlocked from preview state) is phase 2, gated by payment status at the app layer rather than by DNS provisioning.

---

## 6. Next steps

1. Build the 4-step intake with dummy-data seeding per niche.
2. Wire the intent-capture form (real submission, no payment).
3. Deploy to `dukabee.co.ke`.
4. Send link to Kipruto for a live test.
5. Phase 2: STK push payment → auto-promote store from preview to live paid subdomain.
