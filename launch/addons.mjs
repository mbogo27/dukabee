// Optional add-ons, mirrored from the published Taskbee add-ons (taskbee.co.ke/addons): same offers, same prices.
// Shared by the add-ons page, the launch flow (WhatsApp request message) and the leads API (allow-list).
export const ADDONS = [
  {
    id: 'bulk-upload', icon: '📦', title: 'Bulk product upload', price: 'KSh 5,000 per 100 products',
    blurb: 'We upload, organise, and categorise your catalogue so launch day is not spent on admin.',
    useCase: 'For owners with a large product list ready to publish.',
  },
  {
    id: 'mpesa', icon: '💳', title: 'M-Pesa integration', price: 'KSh 5,000',
    blurb: 'Accept M-Pesa payments directly on your store, with confirmation flowing back to your order records.',
    useCase: 'For stores moving from enquiries to paid orders.',
  },
  {
    id: 'whatsapp', icon: '💬', title: 'WhatsApp integration', tag: 'Chatbot', price: 'KSh 10,000–15,000',
    blurb: 'Automated first response on WhatsApp: common questions, product info, and serious-buyer routing.',
    useCase: 'For businesses losing leads to slow replies.',
  },
  {
    id: 'brand-kit', icon: '🎨', title: 'Logo + brand kit', price: 'From KSh 5,000',
    blurb: 'Logo design and a brand kit, so your store has one consistent identity. Includes 2 concepts and 2 revision rounds.',
    useCase: 'For businesses launching without existing brand assets.',
  },
];

export const ADDON_IDS = ADDONS.map((a) => a.id);
export const addonById = (id) => ADDONS.find((a) => a.id === id);
export const addonLine = (id) => { const a = addonById(id); return a ? `${a.title} (${a.price})` : ''; };
