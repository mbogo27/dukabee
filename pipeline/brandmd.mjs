// brand.md — the compressed brand document. Written from source + mapping, then parsed back by the
// vault stage, so the composer only ever sees what brand.md actually says.
// Shape follows the PaySii convention: Text, Entities, Relations, References (+ a Tokens table).

const row = (k, v) => `| ${k} | ${String(v).replace(/\|/g, '\\|')} |`;

export function writeBrandMd({ source, mapping, productCount, categories }) {
  const s = source.store;
  const b = mapping.brand;
  const heroImages = s.heroImages?.length ? s.heroImages : [];
  const tokens = [
    ...Object.entries(b.tokens).map(([k, v]) => [`color.${k}`, v]),
    ['type.display', b.type.display], ['type.displayWeight', b.type.displayWeight], ['type.body', b.type.body],
    ['type.tracking', b.type.tracking], ['shape.radius', b.shape.radius], ['shape.card', b.shape.cardStyle],
    ['shape.button', b.shape.buttonStyle], ['shape.density', b.shape.density],
    ['layout.hero', b.hero.variant], ['layout.featuredCount', b.featuredCount],
  ];
  return `# ${s.name} — brand.md

## Text
- name: ${s.name}
- wordmark: ${s.wordmark}
- descriptor: ${s.descriptor}
- tagline: ${b.tagline}
- eyebrow: ${b.eyebrow || s.eyebrow}
- hero.title: ${s.heroTitle}
- hero.body: ${s.heroDescription}
- footer: ${s.footerCopy}
- voice: ${b.voice}

## Entities
| entity | kind | detail |
|---|---|---|
| ${s.name} | shop | WhatsApp +${s.whatsapp} · KSh pricing |
| Catalog | collection | ${productCount} products · ${categories.length} categories (${categories.join(', ')}) |
| Logo | wordmark | "${s.wordmark}" set in ${b.type.display} (no logo asset in source) |

## Tokens
| token | value |
|---|---|
${tokens.map(([k, v]) => row(k, v)).join('\n')}

## Relations
- ${s.name} **sells** Catalog (${productCount} products)
- Header **shows** wordmark, nav (Home, Shop) and cart
- Every checkout **goes to** WhatsApp +${s.whatsapp} through the pre-checkout form
- Categories **are** a filterable attribute, not routes

## References
- source: ${source.importedFrom} (imported ${source.importedAt.slice(0, 10)})
- tokens: ${b.tokenSource}
- style note: ${s.styleNote}
${heroImages.map((p) => `- hero image: ${p}`).join('\n') || '- hero image: first featured product'}
`;
}

export function parseBrandMd(md) {
  const sections = {};
  let current = null;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^## (.+)/);
    if (h) { current = h[1].trim(); sections[current] = []; continue; }
    if (current) sections[current].push(line);
  }
  const text = {};
  for (const line of sections.Text || []) {
    const m = line.match(/^- ([\w.]+): (.*)$/);
    if (m) text[m[1]] = m[2];
  }
  const tokens = {};
  for (const line of sections.Tokens || []) {
    const m = line.match(/^\| ([\w.]+) \| (.*) \|$/);
    if (m && m[1] !== 'token') tokens[m[1]] = m[2].replace(/\\\|/g, '|');
  }
  const references = {};
  for (const line of sections.References || []) {
    const m = line.match(/^- ([\w .]+): (.*)$/);
    if (m) (references[m[1]] ||= []).push(m[2]);
  }
  return { text, tokens, references };
}
