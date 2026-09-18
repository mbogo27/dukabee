// WCAG relative-luminance contrast + token safety. Runs at token-generation time for every store
// (the three demos and anything generated from the launch flow).
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [16, 8, 0].map((s) => ((n >> s) & 255) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
};
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const mix = (hex, toward, t) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(toward.slice(1), 16);
  const ch = (v, s) => (v >> s) & 255;
  return '#' + [16, 8, 0].map((s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t).toString(16).padStart(2, '0')).join('');
};
const NEUTRAL_DARK = '#111111';
const NEUTRAL_LIGHT = '#ffffff';

// Text-on-background pairs the templates actually render. `fix` says how to repair a failing pair:
// 'neutral' forces black/white text, 'shift' nudges the text token toward whichever end has more room.
const PAIRS = [
  { text: 'ink', bg: 'paper', min: 4.5, fix: 'neutral' },
  { text: 'ink', bg: 'surface', min: 4.5, fix: 'neutral' },
  { text: 'muted', bg: 'paper', min: 4.5, fix: 'shift' },
  { text: 'accentInk', bg: 'accent', min: 4.5, fix: 'neutral' },
  { text: 'accent', bg: 'paper', min: 4.5, fix: 'shift' },
  { text: 'ink', bg: 'highlight', min: 4.5, fix: 'neutral', setBg: true },
];

export function safeColors(input) {
  const color = { ...input };
  const fixes = [];
  for (const p of PAIRS) {
    const before = contrast(color[p.text], color[p.bg]);
    if (before >= p.min) continue;
    const old = color[p.text];
    if (p.fix === 'neutral' && !p.setBg) {
      color[p.text] = contrast(NEUTRAL_DARK, color[p.bg]) >= contrast(NEUTRAL_LIGHT, color[p.bg]) ? NEUTRAL_DARK : NEUTRAL_LIGHT;
    } else if (p.setBg) {
      // Badge background: keep the hue, move it away from the ink until the ink reads on it.
      const away = lum(color.ink) < 0.5 ? NEUTRAL_LIGHT : NEUTRAL_DARK;
      let t = 0; let v = color[p.bg];
      while (contrast(color.ink, v) < p.min && t < 1) { t += 0.05; v = mix(input[p.bg], away, t); }
      fixes.push({ pair: `${p.text} on ${p.bg}`, before: +before.toFixed(2), after: +contrast(color.ink, v).toFixed(2), from: color[p.bg], to: v });
      color[p.bg] = v;
      continue;
    } else {
      const toward = lum(color[p.bg]) > 0.5 ? NEUTRAL_DARK : NEUTRAL_LIGHT;
      let t = 0; let v = old;
      while (contrast(v, color[p.bg]) < p.min && t < 1) { t += 0.04; v = mix(old, toward, t); }
      color[p.text] = v;
    }
    fixes.push({ pair: `${p.text} on ${p.bg}`, before: +before.toFixed(2), after: +contrast(color[p.text], color[p.bg]).toFixed(2), from: old, to: color[p.text] });
  }
  return { color, fixes };
}
