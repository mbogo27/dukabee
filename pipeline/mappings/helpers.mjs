// Shared vocabulary for per-demo mapping decisions. A mapping is data, not code paths:
// every demo uses the same attribute schema (key, values, filterable, selectable) and the
// generator has no vertical-specific branches.

/**
 * @param {string} key          attribute key, e.g. "size"
 * @param {Array<string|{value:string,priceDelta?:number,image?:string}>} values
 * @param {{filterable?:boolean, selectable?:boolean, label?:string, evidence:string, assumed?:boolean}} opts
 */
export const attr = (key, values, opts) => ({
  key,
  label: opts.label || key[0].toUpperCase() + key.slice(1),
  values: (Array.isArray(values) ? values : [values]).map((v) => (typeof v === 'string' ? { value: v } : v)),
  filterable: !!opts.filterable,
  selectable: !!opts.selectable,
  evidence: opts.evidence,
  assumed: !!opts.assumed,
});

export const TOP_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
export const WAIST_SIZES = ['30', '32', '34', '36'];
