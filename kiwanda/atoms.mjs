// Atoms — div, button, heading, paragraph, list / list-item, image, link.
// No styling, no behaviour: shared by fixed-canvas and web mode. Behaviour is bound at the section layer.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const attrs = (a = {}) => Object.entries(a)
  .filter(([, v]) => v !== false && v != null)
  .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`))
  .join('');

const kids = (c) => (Array.isArray(c) ? c.filter(Boolean).join('') : c ?? '');

export const el = (tag, a, children) => `<${tag}${attrs(a)}>${kids(children)}</${tag}>`;
export const div = (a, children) => el('div', a, children);
export const button = (a, label) => el('button', { type: 'button', ...a }, label);
export const heading = (level, a, text) => el(`h${level}`, a, text);
export const paragraph = (a, text) => el('p', a, text);
export const list = (a, items) => el('ul', a, items);
export const listItem = (a, children) => el('li', a, children);
export const link = (a, children) => el('a', a, children);
export const image = (a) => `<img${attrs({ loading: 'lazy', decoding: 'async', ...a })}>`;
export const raw = (html) => html;
