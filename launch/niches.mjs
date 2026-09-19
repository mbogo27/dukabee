// Dummy-data niche templates (MVP spec §2): 8 niches x 5 products. Each product has a name, price (KSh),
// category tag and one flexible attribute value. The attribute label and whether buyers must pick a value
// are set per niche. Attribute values are comma-separated; several values on a selectable attribute
// become a selector on the product page. Photos are generated placeholders (tinted to the store's brand).
// Brand names are invented so sample data never implies a real stockist.

const P = (name, price, category, attr, description) => ({ name, price, category, attr, description });

export const NICHES = {
  electronics: {
    label: 'Electronics', emoji: '🎧',
    attr: { label: 'Brand', selectable: false },
    hero: 'Tech that keeps up with you.',
    body: 'Audio, power and smart gadgets with warranty. Order on WhatsApp and we deliver.',
    products: [
      P('Wireless Earbuds Pro', 2800, 'Audio', 'Pulse', 'Bluetooth 5.3 earbuds with charging case and up to 24 hours of playtime.'),
      P('20,000mAh Power Bank', 3200, 'Power', 'Volt', 'Fast-charge power bank with dual USB and USB-C ports.'),
      P('43" Smart LED TV', 28500, 'TVs', 'Nova', 'Full HD smart TV with built-in apps and three HDMI ports.'),
      P('Portable Bluetooth Speaker', 4200, 'Audio', 'Pulse', 'Water-resistant speaker with deep bass and a 12-hour battery.'),
      P('Smart Watch Series 5', 5500, 'Wearables', 'Nova', 'Tracks steps, heart rate and sleep, with call and message alerts.'),
    ],
  },
  cosmetics: {
    label: 'Cosmetics', emoji: '💄',
    attr: { label: 'Skin type', selectable: false },
    hero: 'Small rituals. Big glow.',
    body: 'Skincare and makeup for everyday routines. Ask us anything on WhatsApp.',
    products: [
      P('Hydrating Face Serum 30ml', 1900, 'Skincare', 'All skin types', 'Lightweight hyaluronic serum that plumps and smooths.'),
      P('Matte Liquid Lipstick', 850, 'Makeup', 'All skin types', 'Long-wear matte colour that stays put through the day.'),
      P('Shea Body Butter 200g', 1200, 'Body care', 'Dry', 'Rich, whipped shea butter for soft, all-day moisture.'),
      P('SPF 50 Face Sunscreen', 1650, 'Skincare', 'Oily', 'Non-greasy daily sunscreen with a matte finish.'),
      P('Volumising Mascara', 1100, 'Makeup', 'All skin types', 'Buildable volume and length, smudge-resistant.'),
    ],
  },
  kitchen: {
    label: 'Kitchen utensils', emoji: '🍳',
    attr: { label: 'Capacity', selectable: false },
    hero: 'Tools for the meals you make.',
    body: 'Cookware, appliances and everyday helpers for busy kitchens.',
    products: [
      P('Electric Kettle 1.7L', 2600, 'Appliances', 'Up to 2 L', 'Fast-boil stainless steel kettle with auto shut-off.'),
      P('5L Pressure Cooker', 4200, 'Cookware', '2-5 L', 'Aluminium pressure cooker that cuts cooking time by up to 70%.'),
      P('Personal Blender 1.5L', 3400, 'Appliances', 'Up to 2 L', 'Powerful blender for smoothies, soups and sauces.'),
      P('Insulated Flask 1L', 1600, 'Drinkware', 'Up to 2 L', 'Keeps drinks hot for 12 hours and cold for 24.'),
      P('Stainless Steel Pot Set 6.5L', 5200, 'Cookware', '5 L+', 'Five-piece pot set with glass lids, works on any stove.'),
    ],
  },
  fitness: {
    label: 'Gym / fitness', emoji: '🏋️',
    attr: { label: 'Option', selectable: true },
    hero: 'Train harder. Recover better.',
    body: 'Gym gear and accessories for home workouts and the gym floor.',
    products: [
      P('Non-Slip Yoga Mat', 1800, 'Mats', 'Blue, Black', '6mm cushioned mat with a grippy surface.'),
      P('Adjustable Dumbbell (Pair)', 4500, 'Weights', '5 kg, 10 kg, 15 kg', 'Rubber-coated dumbbells, sold as a pair.'),
      P('Resistance Band Set', 1200, 'Accessories', 'Light, Medium, Heavy', 'Latex bands for strength, stretching and rehab.'),
      P('Speed Jump Rope', 700, 'Cardio', '', 'Adjustable rope with ball bearings for smooth spins.'),
      P('Protein Shaker Bottle', 600, 'Accessories', 'Black, Pink', 'Leak-proof 700ml shaker with mixing ball.'),
    ],
  },
  baby: {
    label: 'Baby store', emoji: '🍼',
    attr: { label: 'Age', selectable: true },
    hero: 'Everything for the little one.',
    body: 'Gentle, safe essentials for babies and toddlers.',
    products: [
      P('Baby Diapers Jumbo Pack', 2400, 'Diapers', '0-6 months, 6-12 months, 1-3 years', 'Soft, ultra-absorbent diapers with a wetness indicator.'),
      P('Cotton Onesies 3-Pack', 1200, 'Clothing', '0-6 months, 6-12 months', 'Breathable 100% cotton bodysuits with snap closure.'),
      P('Anti-Colic Feeding Bottle', 750, 'Feeding', '0-6 months', 'BPA-free bottle with a vent that reduces gas and colic.'),
      P('Baby Bath Tub with Stand', 3200, 'Bath', '0-6 months', 'Foldable tub with a non-slip base and drain plug.'),
      P('Soft Plush Teddy Bear', 900, 'Toys', '6-12 months, 1-3 years', 'Machine-washable plush toy, safe for little hands.'),
    ],
  },
  clothing: {
    label: 'Clothing / fashion', emoji: '👗',
    attr: { label: 'Size', selectable: true },
    hero: 'Everyday style, delivered.',
    body: 'Shirts, dresses and denim picked for how you actually live.',
    products: [
      P('Linen Button-Down Shirt', 2400, 'Shirts', 'S, M, L, XL', 'Breathable linen shirt with a relaxed, tailored fit.'),
      P('Classic Denim Jacket', 4200, 'Jackets', 'S, M, L, XL', 'Mid-wash denim jacket with two chest pockets.'),
      P('Ankara Wrap Dress', 3800, 'Dresses', 'S, M, L', 'Bold Ankara print wrap dress with a flattering midi length.'),
      P('Slim Fit Chinos', 2900, 'Trousers', '30, 32, 34, 36', 'Stretch cotton chinos that dress up or down.'),
      P('Oversized Cotton Tee', 1200, 'T-Shirts', 'S, M, L, XL', 'Heavyweight cotton tee with a dropped shoulder.'),
    ],
  },
  phone: {
    label: 'Phone accessories', emoji: '📱',
    attr: { label: 'Fits', selectable: true },
    hero: 'Protect it. Power it. Show it off.',
    body: 'Cases, chargers and accessories for the phone in your pocket.',
    products: [
      P('Shockproof Phone Case', 800, 'Cases', 'iPhone 13, iPhone 14, Samsung A54', 'Raised edges and air cushions absorb drops.'),
      P('Tempered Glass Screen Protector', 400, 'Protection', 'iPhone 13, iPhone 14, Samsung A54', '9H hardness glass with an easy-apply frame.'),
      P('1m Fast Charging Cable', 600, 'Cables', 'USB-C, Lightning', 'Braided cable supporting fast charging and data sync.'),
      P('Foldable Phone Stand', 500, 'Holders', '', 'Adjustable aluminium stand for desks and video calls.'),
      P('10,000mAh Slim Power Bank', 2400, 'Power', '', 'Pocket-size power bank with USB-C fast charge.'),
    ],
  },
  pantry: {
    label: 'Food / pantry', emoji: '🍚',
    attr: { label: 'Pack size', selectable: false },
    hero: 'Fresh pantry staples, delivered.',
    body: 'Everyday groceries and pantry favourites at fair prices.',
    products: [
      P('Pishori Rice 2kg', 450, 'Grains', '2 kg', 'Aromatic long-grain rice that cooks up fluffy.'),
      P('Wheat Flour 2kg', 220, 'Baking', '2 kg', 'All-purpose flour for chapati, mandazi and baking.'),
      P('Cooking Oil 1L', 380, 'Oils', '1 L', 'Refined vegetable oil for frying and cooking.'),
      P('Loose Tea Leaves 500g', 300, 'Beverages', '500 g', 'Strong, rich Kenyan black tea leaves.'),
      P('Natural Honey 500g', 650, 'Spreads', '500 g', 'Pure, unprocessed honey from local beekeepers.'),
    ],
  },
};

export const NICHE_IDS = Object.keys(NICHES);
// Old landing-page category ids, so previously shared /store/?cat=… links keep working.
export const LEGACY_CAT = { fashion: 'clothing', kitchen: 'kitchen', beauty: 'cosmetics' };
export const POLICY_PRESETS = [
  'Pickup only', 'Delivery within Nairobi', 'Countrywide delivery', 'Free delivery over KSh 5,000',
  'Returns within 7 days', 'Exchange only', 'No returns on opened items',
];
export const CATEGORY_LABELS = Object.fromEntries(Object.entries(NICHES).map(([id, n]) => [id, n.label]));
