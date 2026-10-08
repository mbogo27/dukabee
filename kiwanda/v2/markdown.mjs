// Guides content: a small Markdown reader for store articles, with leaf directives for live product embeds
// (`::product{slug="…"}`, `::products{slugs="a,b"}`, `::compare{slugs="a,b,c"}`). Every block keeps its source line so
// build errors can point at file:line. Supports what guides use: frontmatter, ## headings, paragraphs, - lists,
// **bold**, *italic*, `code` and [links](url). Anything fancier should wait for the EmDash ContentSource.
import { esc } from '../atoms.mjs';

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text, bodyLine: 1 };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"');
    data[kv[1]] = v;
  }
  return { data, body: text.slice(m[0].length), bodyLine: m[0].split(/\n/).length };
}

const parseAttrs = (s) => Object.fromEntries([...String(s || '').matchAll(/([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));

/** Body → blocks with 1-based source line numbers (relative to the whole file). */
export function parseBlocks(body, firstLine = 1) {
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let para = null, list = null;
  const flush = () => { if (para) blocks.push(para); if (list) blocks.push(list); para = null; list = null; };
  lines.forEach((raw, i) => {
    const line = firstLine + i;
    const t = raw.trim();
    if (!t) return flush();
    let m;
    if ((m = t.match(/^::([a-z][a-z-]*)(?:\{(.*)\})?\s*$/i))) { flush(); blocks.push({ type: 'directive', name: m[1], attrs: parseAttrs(m[2]), line }); return; }
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) { flush(); blocks.push({ type: 'heading', level: m[1].length, text: m[2], line }); return; }
    if ((m = t.match(/^[-*]\s+(.*)$/))) { if (para) { blocks.push(para); para = null; } list ||= { type: 'list', items: [], line }; list.items.push({ text: m[1], line }); return; }
    if (list && /^\s{2,}/.test(raw)) { list.items[list.items.length - 1].text += ` ${t}`; return; }
    if (list) { blocks.push(list); list = null; }
    if (para) para.text += ` ${t}`; else para = { type: 'paragraph', text: t, line };
  });
  flush();
  return blocks;
}

/** Inline Markdown → HTML. Text is escaped first; only http(s), mailto, tel and site-relative links are kept. */
export function inline(md) {
  const codes = [];
  let s = esc(md).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
    const h = href.replace(/&amp;/g, '&');
    if (!/^(https?:|mailto:|tel:|\/|#)/.test(h)) return text;
    const external = /^https?:/.test(h);
    return `<a href="${esc(h)}"${external ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codes[Number(i)]}</code>`);
}

export const plainText = (md) => String(md).replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1');
export const slugify = (s) => plainText(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Parse one guide file into { meta, blocks }. */
export function parseGuide(text, file) {
  const { data, body, bodyLine } = parseFrontmatter(text);
  return { file, meta: data, blocks: parseBlocks(body, bodyLine) };
}
