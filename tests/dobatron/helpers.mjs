import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA = path.join(ROOT, 'data/dobatron');
export const FIXTURES = path.join(ROOT, 'tests/fixtures/dobatron');
export const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export const seed = () => readJson(path.join(FIXTURES, 'dobatron-catalog.json'));

/** The real supplier sheet when it's been dropped in, else the reconstructed stand-in (see make-fixture.mjs). */
export function stockSheet() {
  const real = path.join(DATA, 'source/laptop_stock_no_markup.xlsx');
  return fs.existsSync(real) ? real : path.join(FIXTURES, 'laptop_stock_2026-10-08.reconstructed.xlsx');
}

/** A throwaway copy of data/dobatron to mutate in a test. */
export function tempData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dobatron-data-'));
  fs.cpSync(DATA, dir, { recursive: true });
  return dir;
}
export const tempDir = (prefix = 'dobatron-out-') => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

export function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
