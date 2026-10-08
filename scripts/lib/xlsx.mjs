// Minimal .xlsx reader/writer, no dependencies: enough for supplier stock sheets (one table of text + numbers).
// Reads the ZIP container with node:zlib, then the workbook / shared-strings / sheet XML with small regexes.
// Not a general spreadsheet library: no formulas, styles or dates (cells come back as strings or numbers).
import zlib from 'node:zlib';

// ---- ZIP ----
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a ZIP/XLSX file (no end-of-central-directory record)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt ZIP central directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + size);
    files.set(name, () => (method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : (() => { throw new Error(`Unsupported ZIP method ${method} for ${name}`); })()));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const data = Buffer.from(content, 'utf8');
    const deflated = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(deflated.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12); central.writeUInt32LE(crc, 16); central.writeUInt32LE(deflated.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, deflated);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + deflated.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// ---- XML helpers ----
const decode = (s) => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => (
  { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()] ?? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))));
const encode = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const texts = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('');
const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/**
 * Read one sheet of an .xlsx buffer.
 * @returns {{ sheet: string, rows: { row: number, cells: (string|number|null)[] }[] }} 1-based sheet row numbers.
 */
export function readXlsx(buf, { sheet } = {}) {
  const files = unzip(buf);
  const read = (name) => { const f = files.get(name); if (!f) throw new Error(`XLSX is missing ${name}`); return f().toString('utf8'); };
  const workbook = read('xl/workbook.xml');
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({ name: decode(attr(m[0], 'name') || ''), rid: attr(m[0], 'r:id') }));
  if (!sheets.length) throw new Error('XLSX has no sheets');
  const chosen = sheet ? sheets.find((s) => s.name === sheet) : sheets[0];
  if (!chosen) throw new Error(`XLSX has no sheet named "${sheet}" (found: ${sheets.map((s) => s.name).join(', ')})`);
  const rels = read('xl/_rels/workbook.xml.rels');
  const target = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => attr(t, 'Id') === chosen.rid);
  const path = attr(target || '', 'Target') || 'worksheets/sheet1.xml';
  const sheetPath = path.startsWith('/') ? path.slice(1) : `xl/${path}`;
  const shared = files.has('xl/sharedStrings.xml') ? [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1])) : [];
  const rows = [];
  for (const rm of read(sheetPath).matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const row = Number(attr(rm[1], 'r'));
    const cells = [];
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cm[1], 'r'), type = attr(cm[1], 't'), body = cm[2] || '';
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = null;
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = texts(body);
      else if (type === 'str' || type === 'e') value = v != null ? decode(v) : null;
      else if (type === 'b') value = v === '1';
      else if (v != null) value = Number(v);
      cells[ref ? colIndex(ref) : cells.length] = value;
    }
    rows.push({ row, cells: Array.from(cells, (c) => c ?? null) });
  }
  return { sheet: chosen.name, rows };
}

/** Write a single-sheet .xlsx (inline strings, numeric cells as numbers). Used for test fixtures. */
export function writeXlsx(rows, { sheet = 'Sheet1' } = {}) {
  const col = (i) => { let s = ''; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const ref = `${col(ci)}${ri + 1}`;
    if (v == null || v === '') return '';
    return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${encode(v)}</t></is></c>`;
  }).join('')}</row>`).join('')}</sheetData></worksheet>`;
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${encode(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', sheetXml],
  ]);
}
