// Ramani vault expansion: shop entity + product entities, built from parsed brand.md + source + mapping.
// Returns the vault plus any mapping problems found along the way (logged as findings, never dropped).

export function expandVault({ demo, brandDoc, source, mapping }) {
  const problems = [];
  const t = brandDoc.tokens;
  const shop = {
    type: 'shop',
    id: demo,
    name: brandDoc.text.name,
    wordmark: brandDoc.text.wordmark,
    descriptor: brandDoc.text.descriptor,
    tagline: brandDoc.text.tagline,
    eyebrow: brandDoc.text.eyebrow,
    hero: { title: brandDoc.text['hero.title'], body: brandDoc.text['hero.body'], variant: t['layout.hero'], images: brandDoc.references['hero image']?.filter((p) => p.startsWith('images/')) || [] },
    footer: brandDoc.text.footer,
    whatsapp: source.store.whatsapp,
    currency: 'KSh',
    featuredCount: Number(t['layout.featuredCount']) || 4,
    theme: {
      color: Object.fromEntries(Object.entries(t).filter(([k]) => k.startsWith('color.')).map(([k, v]) => [k.slice(6), v])),
      type: { display: t['type.display'], displayWeight: Number(t['type.displayWeight']), body: t['type.body'], tracking: t['type.tracking'] },
      shape: { radius: t['shape.radius'], card: t['shape.card'], button: t['shape.button'], density: t['shape.density'] },
    },
  };

  const used = new Set();
  const bySlug = new Map();
  const merges = [];
  for (const sp of source.products) {
    const rule = mapping.products.find((m) => sp.slug.startsWith(m.match));
    if (!rule) { problems.push({ severity: 'gap', text: `Source product "${sp.name}" has no vault mapping and was not rendered.` }); continue; }
    used.add(rule);
    if (rule.mergeInto) { merges.push({ into: rule.mergeInto, from: sp }); continue; }
    bySlug.set(rule.slug, {
      type: 'product',
      id: rule.slug,
      slug: rule.slug,
      name: rule.title || sp.name,
      sourceName: sp.name,
      price: rule.basePrice ?? sp.price,
      image: rule.image || sp.image,
      description: rule.description || sp.description,
      attributes: rule.attributes,
      provenance: { sourceSlugs: rule.mergedFrom || [sp.slug], rawDescription: !!sp.rawDescription },
    });
  }
  for (const { into, from } of merges) {
    const target = bySlug.get(into);
    if (!target) problems.push({ severity: 'gap', text: `Merge target "${into}" missing for "${from.name}".` });
  }
  for (const rule of mapping.products) {
    if (!used.has(rule)) problems.push({ severity: 'gap', text: `Mapping rule "${rule.match}" matched no source product.` });
  }

  const products = [...bySlug.values()];
  for (const p of products) {
    for (const a of p.attributes) {
      if (a.selectable && a.values.length < 2) problems.push({ severity: 'gap', text: `${p.name}: "${a.key}" is selectable but has only one value.` });
    }
  }
  return { shop, products, problems };
}

// Facets = attributes flagged filterable, aggregated across the collection.
export function facetsFor(products) {
  const map = new Map();
  for (const p of products) for (const a of p.attributes) {
    if (!a.filterable) continue;
    if (!map.has(a.key)) map.set(a.key, { key: a.key, label: a.key === 'size' ? 'Size' : a.label, values: new Map() });
    const f = map.get(a.key);
    for (const v of a.values) f.values.set(v.value, (f.values.get(v.value) || 0) + 1);
  }
  const order = (k) => (k === 'category' ? 0 : 1);
  const sizeRank = (v) => { const i = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].indexOf(v); return i >= 0 ? i : 100 + Number(v) || 999; };
  return [...map.values()].sort((a, b) => order(a.key) - order(b.key)).map((f) => ({
    key: f.key,
    label: f.label,
    values: [...f.values.entries()].map(([value, count]) => ({ value, count }))
      .sort((a, b) => (f.key === 'size' ? sizeRank(a.value) - sizeRank(b.value) : b.count - a.count || a.value.localeCompare(b.value))),
  }));
}
