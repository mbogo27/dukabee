// Laptop vertical for the supplier-sheet importer: parses a free-text "Specifications" cell
// ("i5 8th Gen, 8GB/256GB, Touchscreen", "AMD Ryzen 5, 16GB/256GB, 2GB Graphics, Touch", "M5, 4GB/128GB, incl. Stylus Pen")
// into attributes, and names/slugs/describes one configuration. Model facts the sheet rarely states (screen size,
// typical CPU generation) come from the model registry and are always listed in `inferred`.

const ORDINAL = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
const genNumber = (gen) => (gen ? Number.parseInt(gen, 10) : null);

/** CPU family, checked in a fixed order so "Ryzen 7 Pro 2500U" never reads as plain "Ryzen 7". */
function parseCpu(text) {
  let m;
  if ((m = text.match(/Ryzen\s*([357])\s*Pro\s*(\d{4}[A-Z]*)/i))) return { family: 'amd', attr: `AMD Ryzen ${m[1]}`, token: `ryzen-${m[1]}`, label: `AMD Ryzen ${m[1]} Pro ${m[2].toUpperCase()}`, ryzenSeries: Number(m[2][0]) * 1000 };
  if ((m = text.match(/Ryzen\s*([357])\s*Pro\b/i))) return { family: 'amd', attr: `AMD Ryzen ${m[1]}`, token: `ryzen-${m[1]}`, label: `AMD Ryzen ${m[1]} Pro` };
  if ((m = text.match(/Ryzen\s*([357])\b/i))) return { family: 'amd', attr: `AMD Ryzen ${m[1]}`, token: `ryzen-${m[1]}`, label: `AMD Ryzen ${m[1]}` };
  if ((m = text.match(/\bi([357])\b/i))) return { family: 'core', attr: `Intel Core i${m[1]}`, token: `i${m[1]}`, label: `Core i${m[1]}` };
  if (/\bm5\b/i.test(text)) return { family: 'core', attr: 'Intel Core m5', token: 'm5', label: 'Core m5' };
  if (/celeron/i.test(text)) return { family: 'celeron', attr: 'Intel Celeron', token: 'celeron', label: 'Celeron' };
  return null;
}

/**
 * Parse one sheet row's specs against its registry model.
 * Returns null fields plus an `error` string when the cell can't be read (the importer fails the run on those).
 */
export function parseLaptopSpecs(text, model, { brand } = {}) {
  const s = String(text ?? '').trim();
  const cpu = parseCpu(s);
  if (!cpu) return { error: `can't find a processor in "${s}"` };
  const mem = s.match(/(\d+)\s*GB\s*\/\s*(\d+)\s*(GB|TB)/i);
  if (!mem) return { error: `can't find RAM/storage (like 8GB/256GB) in "${s}"` };
  const hdd = s.match(/\+\s*(\d+)\s*TB\s*HDD/i);
  const gpu = s.match(/(\d+)\s*GB\s+(?:Dedicated\s+|Nvidia\s+)?Graphics/i);
  const genMatch = s.match(/(\d+)\s*(?:st|nd|rd|th)\s*Gen/i);
  const noTouchBar = s.replace(/touch\s*bar/gi, '');
  const touchStated = /non[-\s]?touch/i.test(noTouchBar) ? 'No' : /touch/i.test(noTouchBar) ? 'Yes' : null;

  const inferred = [];
  const formFactor = model.formFactor;
  let touch = touchStated;
  if (formFactor === 'Convertible' || formFactor === 'Detachable') touch = 'Yes';
  else if (formFactor === 'Mini PC') touch = touchStated || 'No';
  else if (!touchStated) { touch = 'No'; inferred.push('touch'); }

  // Intel generation: stated, else the model's typical one (never guessed when the model spans generations).
  let cpuGen = null, genInferred = false;
  if (cpu.family === 'core') {
    if (genMatch) cpuGen = `${ORDINAL(Number(genMatch[1]))} Gen`;
    else if (model.typicalCpuGen) { cpuGen = model.typicalCpuGen; genInferred = true; }
  }
  const features = [];
  if (/stylus|\bpen\b/i.test(s)) features.push('Stylus pen');
  if (/touch\s*bar/i.test(s)) features.push('Touch Bar');
  if (hdd) features.push(`Extra ${hdd[1]}TB HDD`);

  return {
    cpu: { ...cpu, ryzenSeries: cpu.ryzenSeries ?? model.typicalRyzenSeries ?? null },
    cpuGen, genInferred,
    ramGB: Number(mem[1]),
    storage: { size: Number(mem[2]), unit: mem[3].toUpperCase(), hddTB: hdd ? Number(hdd[1]) : null },
    touch, touchInferred: inferred.includes('touch'),
    gpuGB: gpu ? Number(gpu[1]) : null,
    features,
    apple: (brand || model.brand) === 'Apple',
  };
}

/** Duplicate key: model + CPU + RAM + storage + touch + features (Touch Bar excluded: sheets disagree on mentioning it). */
export const laptopMergeKey = (modelId, p) => [modelId, p.cpu.attr, p.ramGB, `${p.storage.size}${p.storage.unit}`, p.storage.hddTB || '', p.touch, p.features.filter((f) => f !== 'Touch Bar').sort().join('+')].join('|');

/** Union two parsed rows of the same configuration: stated facts beat inferred ones, extras are combined. */
export function mergeLaptopSpecs(a, b) {
  const stated = (x, y, inf) => (x[inf] && !y[inf] ? y : x);
  const gen = stated(a, b, 'genInferred');
  const touch = stated(a, b, 'touchInferred');
  return {
    ...a,
    cpu: a.cpu.label.length >= b.cpu.label.length ? a.cpu : b.cpu,
    cpuGen: gen.cpuGen, genInferred: gen.genInferred,
    touch: touch.touch, touchInferred: touch.touchInferred,
    gpuGB: Math.max(a.gpuGB || 0, b.gpuGB || 0) || null,
    features: [...new Set([...a.features, ...b.features])],
  };
}

const storageText = (st) => `${st.size}${st.unit}${st.hddTB ? ` + ${st.hddTB}TB HDD` : ''}`;
const storageToken = (st) => `${st.size}${st.unit.toLowerCase()}${st.hddTB ? `-${st.hddTB}tbhdd` : ''}`;
const FEATURE_ORDER = ['Stylus pen', 'Touch Bar'];
const sortFeatures = (fs) => fs.slice().sort((x, y) => (FEATURE_ORDER.indexOf(x) + 1 || 9) - (FEATURE_ORDER.indexOf(y) + 1 || 9));

/** Windows 11 readiness: macOS for Apple; Intel 8th Gen+ yes, 7th and older no; unknown/Celeron/Ryzen 2000 "Check". */
export function windows11For(p) {
  if (p.apple) return 'macOS';
  if (p.cpu.family === 'amd') return p.cpu.ryzenSeries == null ? 'Check' : p.cpu.ryzenSeries >= 3000 ? 'Yes' : 'Check';
  if (p.cpu.family === 'celeron') return 'Check';
  const g = genNumber(p.cpuGen);
  return g == null ? 'Check' : g >= 8 ? 'Yes' : 'No';
}

/** Build the product record (everything except price/stock lifecycle, which the importer owns). */
export function buildLaptopProduct(p, model, { condition, extraInferred = [] }) {
  const clamshell = model.formFactor === 'Clamshell';
  const intel = p.cpu.family !== 'amd';
  const slug = [model.modelId, p.cpu.token, `${p.ramGB}gb`, storageToken(p.storage)].join('-')
    + (clamshell && p.touch === 'Yes' ? '-touch' : '') + (p.features.includes('Stylus pen') ? '-pen' : '');
  const cpuLabel = p.cpu.label + (intel && p.cpuGen ? ` ${p.cpuGen}` : '');
  const name = `${model.name} · ${cpuLabel}, ${p.ramGB}GB/${storageText(p.storage)}`
    + (clamshell && p.touch === 'Yes' ? ', Touch' : '')
    + (p.gpuGB ? `, ${p.gpuGB}GB GPU` : '')
    + (p.features.includes('Stylus pen') ? ', + Pen' : '')
    + (p.features.includes('Touch Bar') ? ', Touch Bar' : '');
  const cpuDesc = p.cpu.family === 'amd' ? p.cpu.label
    : p.cpu.family === 'celeron' ? 'Intel Celeron'
      : `Intel ${p.cpu.label}${p.cpuGen ? ` (${p.cpuGen})` : ''}`;
  const description = `${model.blurb} This unit: ${cpuDesc}, ${p.ramGB}GB RAM, ${storageText(p.storage)} storage`
    + (p.touch === 'Yes' ? ', touchscreen' : '') + (p.gpuGB ? `, ${p.gpuGB}GB dedicated graphics` : '') + '.'
    + (p.features.includes('Stylus pen') ? ' Stylus pen included.' : '') + (p.features.includes('Touch Bar') ? ' Touch Bar.' : '');

  const attributes = {
    brand: [model.brand], series: [model.series], cpu: [p.cpu.attr], ram: [`${p.ramGB}GB`], storage: [`${p.storage.size}${p.storage.unit}`],
    touch: [p.touch], formFactor: [model.formFactor], graphics: [p.gpuGB ? 'Dedicated' : 'Integrated'], windows11: [windows11For(p)], condition: [condition],
  };
  if (intel && p.cpuGen) attributes.cpuGen = [p.cpuGen];
  if (model.screenInches) attributes.screen = [`${model.screenInches}"`];
  if (p.gpuGB) attributes.gpuMemory = [`${p.gpuGB}GB`];
  if (p.features.length) attributes.features = sortFeatures(p.features);

  const inferred = [];
  if (intel && p.cpuGen && p.genInferred) inferred.push('cpuGen');
  if (model.screenInches) inferred.push('screen');
  if (p.touchInferred) inferred.push('touch');
  for (const k of extraInferred) if (!inferred.includes(k)) inferred.push(k);

  return { id: slug, slug, modelId: model.modelId, name, categoryId: model.categoryId, images: model.images, description, attributes, inferred };
}

// ---- price inversions: within one model, a configuration that is at least as good on every core spec
// (same CPU family, ≥ CPU tier, ≥ RAM, ≥ storage, touch ≥ non-touch) and better on one, yet cheaper ----
const CPU_TIER = { 'Intel Core i3': 3, 'Intel Core i5': 5, 'Intel Core i7': 7, 'AMD Ryzen 5': 5, 'AMD Ryzen 7': 7 };
const cpuFamily = (c) => (c.startsWith('AMD') ? 'amd' : c.startsWith('Intel Core i') ? 'core' : c);
const gb = (v) => Number.parseInt(v, 10) * (/TB/i.test(v) ? 1000 : 1);
export function priceInversions(products) {
  const out = [];
  const byModel = Map.groupBy(products.filter((p) => p.stock !== 'out'), (p) => p.modelId);
  for (const list of byModel.values()) for (const hi of list) for (const lo of list) {
    if (hi === lo || hi.price >= lo.price) continue;
    const [a, b] = [hi.attributes, lo.attributes];
    if (cpuFamily(a.cpu[0]) !== cpuFamily(b.cpu[0])) continue;
    const dims = [
      (CPU_TIER[a.cpu[0]] ?? 0) - (CPU_TIER[b.cpu[0]] ?? 0),
      gb(a.ram[0]) - gb(b.ram[0]),
      gb(a.storage[0]) - gb(b.storage[0]),
      (a.touch[0] === 'Yes') - (b.touch[0] === 'Yes'),
    ];
    if (dims.every((d) => d >= 0) && dims.some((d) => d > 0)) out.push({ better: hi, worse: lo });
  }
  return out;
}
