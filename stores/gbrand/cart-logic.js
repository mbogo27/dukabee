// Pure cart rules for the GBRAND store. No DOM: used by gbrand.js in the browser and by the unit tests in node.

/** Lines are unique by slug + size + print. */
export const lineKey = (slug, size, print) => `${slug}|${size}|${print ? `${print.name}#${print.number}` : ''}`;

export const ksh = (n) => `KSh ${Number(n).toLocaleString('en-KE')}`;

/**
 * Pair deal: every jersey unit sorted by base price (print fee excluded), high to low, paired in order.
 * A pair's discount is max(0, a + b - pairPrice), so it is never negative and a lower pairPrice works with no code change.
 */
export function totals(lines, products, offers) {
  const printFee = offers.print?.enabled === false ? 0 : offers.print?.fee ?? 0;
  const pair = offers.pairBundle;
  let subtotal = 0;
  const units = [];
  for (const l of lines) {
    const p = products[l.slug];
    if (!p) continue;
    subtotal += (p.price + (l.print ? printFee : 0)) * l.qty;
    if (!pair?.appliesTo || pair.appliesTo === p.category) for (let i = 0; i < l.qty; i++) units.push(p.price);
  }
  units.sort((a, b) => b - a);
  let discount = 0;
  if (pair?.enabled !== false && pair?.pairPrice) for (let i = 0; i + 1 < units.length; i += 2) discount += Math.max(0, units[i] + units[i + 1] - pair.pairPrice);
  const count = lines.reduce((n, l) => n + (products[l.slug] ? l.qty : 0), 0);
  return { subtotal, discount, total: subtotal - discount, count, jerseyUnits: units.length };
}

/** Name: letters, space, ' . - only, at most 12, shown uppercase. Number: digits only, 0-99. */
export const cleanPrintName = (s, max = 12) => String(s).replace(/[^a-zA-Z' .-]/g, '').slice(0, max);
export const cleanPrintNumber = (s) => String(s).replace(/\D/g, '').slice(0, 2);

/** Order reference GB-YYMMDD-XXXX (no look-alike characters). */
export function makeRef(now = new Date(), rand = Math.random) {
  const d = new Date(now.getTime() + 3 * 3600e3); // Nairobi, UTC+3
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[Math.floor(rand() * A.length)];
  return `GB-${ymd}-${s}`;
}

/**
 * checkout.messageTemplate renderer: {{var}}, and {{#key}}...{{/key}} sections (arrays repeat, truthy values render once).
 * Inside a section, names resolve against the section's item first, then outward.
 */
export function renderTemplate(tpl, ctx) {
  const lookup = (stack, k) => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i] && k in stack[i]) return stack[i][k]; return ''; };
  const render = (t, stack) => t.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}|\{\{(\w+)\}\}/g, (_, sec, inner, v) => {
    if (v) return String(lookup(stack, v) ?? '');
    const val = lookup(stack, sec);
    if (Array.isArray(val)) return val.map((item) => render(inner, [...stack, item])).join('');
    return val ? render(inner, typeof val === 'object' ? [...stack, val] : stack) : '';
  });
  return render(tpl, [ctx]);
}

/** Put the order reference on the first line of the WhatsApp message. */
export function withRef(message, ref) {
  const nl = message.indexOf('\n');
  const first = nl < 0 ? message : message.slice(0, nl);
  const rest = nl < 0 ? '' : message.slice(nl);
  const tagged = first.endsWith(':') ? `${first.slice(0, -1)} (Ref ${ref}):` : `${first} (Ref ${ref})`;
  return tagged + rest;
}

/** Build the message from the cart using checkout.messageTemplate. */
export function orderMessage({ template, lines, products, offers, customer, ref }) {
  const t = totals(lines, products, offers);
  const printFee = offers.print?.fee ?? 0;
  const ctx = {
    lines: lines.filter((l) => products[l.slug]).map((l) => {
      const p = products[l.slug];
      return {
        name: p.name, no: p.no, size: l.size, qty: l.qty,
        print: l.print ? { printName: l.print.name, printNumber: l.print.number } : false,
        lineTotal: ksh((p.price + (l.print ? printFee : 0)) * l.qty),
      };
    }),
    subtotal: ksh(t.subtotal),
    discount: t.discount ? ksh(t.discount) : '',
    total: ksh(t.total),
    name: customer.name || '—', phone: customer.phone || '—', fulfilment: customer.fulfilment || '—', location: customer.location || '—',
  };
  return withRef(renderTemplate(template, ctx), ref);
}
