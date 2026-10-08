// Supplier-sheet import pattern (generic Duka Bee capability): a raw sheet → a model registry lookup → parsed
// rows → merged duplicates → products with stable slugs, store pricing, and a stock lifecycle that never deletes a page.
// The vertical-specific part (how to read a "Specifications" cell, how to name a product) is passed in by the caller;
// see pipeline/verticals/laptops.mjs for the laptop one.

/** Locate the header row and return data rows as objects keyed by the requested column names. */
export function readSheetTable(rows, columns) {
  const norm = (v) => String(v ?? '').trim().toLowerCase();
  const headerIdx = rows.findIndex((r) => columns.every((c) => r.cells.some((cell) => norm(cell) === norm(c))));
  if (headerIdx < 0) throw new Error(`No header row with columns: ${columns.join(' | ')}`);
  const header = rows[headerIdx].cells.map(norm);
  const idx = Object.fromEntries(columns.map((c) => [c, header.indexOf(norm(c))]));
  return rows.slice(headerIdx + 1)
    .filter((r) => r.cells.some((c) => c != null && String(c).trim() !== ''))
    .map((r) => ({ row: r.row, ...Object.fromEntries(columns.map((c) => [c, r.cells[idx[c]] ?? null])) }));
}

/** "Brand | Model" exact-match lookup (after trimming) against each model's sheetAliases. */
export function aliasIndex(models) {
  const map = new Map();
  for (const m of models) for (const a of m.sheetAliases || []) {
    const key = a.split('|').map((s) => s.trim()).join(' | ');
    if (map.has(key)) throw new Error(`Sheet alias "${key}" is claimed by both ${map.get(key).modelId} and ${m.modelId}`);
    map.set(key, m);
  }
  return (brand, model) => {
    const key = `${String(brand ?? '').trim()} | ${String(model ?? '').trim()}`;
    return { key, model: map.get(key) || null };
  };
}

/** price = ceil(cost × (1 + markupPct/100) / roundUpTo) × roundUpTo, in whole KES. Cents are settled first so
 *  float noise (45000 × 1.3 = 58500.000000000004) can't push a price up a whole rounding step. */
export function priceFromCost(cost, { markupPct = 0, roundUpTo = 1 } = {}) {
  const marked = Math.round(cost * (100 + markupPct)) / 100;
  return Math.ceil(marked / roundUpTo - 1e-9) * roundUpTo;
}

/** Products missing from the new sheet stay (stock "out") so their URLs keep working; returning products go back "in". */
export function applyStockLifecycle(fresh, previous = []) {
  const freshSlugs = new Set(fresh.map((p) => p.slug));
  const prevBySlug = new Map(previous.map((p) => [p.slug, p]));
  const newlyOut = [], backIn = [], added = [], priceChanges = [];
  for (const p of fresh) {
    const prev = prevBySlug.get(p.slug);
    if (!prev) added.push(p);
    else {
      if (prev.stock === 'out') backIn.push(p);
      if (prev.price !== p.price) priceChanges.push({ slug: p.slug, name: p.name, from: prev.price, to: p.price });
    }
  }
  const kept = previous.filter((p) => !freshSlugs.has(p.slug)).map((p) => {
    if (p.stock !== 'out') newlyOut.push(p);
    return { ...p, stock: 'out' };
  });
  return { products: [...fresh, ...kept], newlyOut, backIn, added, priceChanges };
}

export const ksh = (n) => `KSh ${Number(n).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
