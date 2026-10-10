/**
 * xlsxLite — 낱말 문제집 엑셀 양식 읽기·쓰기 (라이브러리 없이, 브라우저 기본 기능만)
 *
 * 단순한 표만 다룬다: 첫 번째 시트의 글자·숫자 칸. 수식은 계산된 값만, 서식·병합·여러 시트는 무시한다.
 *   · readXlsxRows(file) → [{ A: '...', B: '...' }, ...]  (1행부터, 빈 칸은 '')
 *   · makeXlsxBlob(rows, { sheetName, widths }) → .xlsx Blob (압축 없이 저장 — 크기는 작다)
 * xlsx = zip 안의 XML. zip은 직접 읽고(압축 해제는 DecompressionStream), 쓸 때는 압축 없이(stored) 묶는다.
 */

// ── zip 읽기 ──────────────────────────────────────────────
const u16 = (dv, o) => dv.getUint16(o, true);
const u32 = (dv, o) => dv.getUint32(o, true);

const unzip = async (buf) => {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i -= 1) {
    if (u32(dv, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('엑셀(.xlsx) 파일이 아닙니다.');
  const count = u16(dv, eocd + 10);
  let p = u32(dv, eocd + 16);
  const dec = new TextDecoder();
  const files = {};
  for (let n = 0; n < count; n += 1) {
    if (u32(dv, p) !== 0x02014b50) break;
    const method = u16(dv, p + 10);
    const compSize = u32(dv, p + 20);
    const nameLen = u16(dv, p + 28); const extraLen = u16(dv, p + 30); const commentLen = u16(dv, p + 32);
    const local = u32(dv, p + 42);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    const lNameLen = u16(dv, local + 26); const lExtraLen = u16(dv, local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    files[name] = { method, data: new Uint8Array(buf, start, compSize) };
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = async (name) => {
    const f = files[name];
    if (!f) return null;
    if (f.method === 0) return dec.decode(f.data);
    if (f.method !== 8) throw new Error('지원하지 않는 압축 방식입니다.');
    const stream = new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return dec.decode(await new Response(stream).arrayBuffer());
  };
  return { names: Object.keys(files), read };
};

const xml = (text) => new DOMParser().parseFromString(text, 'application/xml');
const tags = (node, name) => Array.from(node.getElementsByTagName(name));
const colOf = (ref) => (String(ref || '').match(/^[A-Z]+/) || ['A'])[0];

export const readXlsxRows = async (file) => {
  if (!/\.xlsx$/i.test(file?.name || '')) throw new Error('엑셀(.xlsx) 파일만 올릴 수 있습니다.');
  const z = await unzip(await file.arrayBuffer());
  // 첫 시트 경로 — workbook.xml의 첫 sheet → rels의 Target
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = await z.read('xl/workbook.xml');
  const rels = await z.read('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const first = tags(xml(wb), 'sheet')[0];
    const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const rel = tags(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === rid);
    if (rel) { const t = rel.getAttribute('Target').replace(/^\//, ''); sheetPath = t.startsWith('xl/') ? t : `xl/${t}`; }
  }
  if (!z.names.includes(sheetPath)) sheetPath = z.names.find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)) || sheetPath;
  const sheet = await z.read(sheetPath);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다.');
  const ssText = await z.read('xl/sharedStrings.xml');
  const shared = ssText ? tags(xml(ssText), 'si').map((si) => tags(si, 't').map((t) => t.textContent).join('')) : [];
  return tags(xml(sheet), 'row').map((row) => {
    const out = {};
    tags(row, 'c').forEach((c) => {
      const t = c.getAttribute('t');
      const v = tags(c, 'v')[0]?.textContent ?? '';
      out[colOf(c.getAttribute('r'))] = t === 's' ? (shared[Number(v)] ?? '') : t === 'inlineStr' ? tags(c, 't').map((x) => x.textContent).join('') : v;
    });
    return out;
  });
};

// ── zip 쓰기 (압축 없이) ───────────────────────────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (bytes) => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i += 1) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

const zip = (entries) => {
  const enc = new TextEncoder();
  const parts = []; const central = []; let offset = 0;
  entries.forEach(({ name, text }) => {
    const nameB = enc.encode(name); const data = enc.encode(text); const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nameB.length, 2], [28, 0, 2]]
      .forEach(([o, v, s]) => (s === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
    parts.push(new Uint8Array(lh.buffer), nameB, data);
    const ch = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nameB.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
      .forEach(([o, v, s]) => (s === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
    central.push(new Uint8Array(ch.buffer), nameB);
    offset += 30 + nameB.length + data.length;
  });
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, entries.length, 2], [10, entries.length, 2], [12, cdSize, 4], [16, offset, 4], [20, 0, 2]]
    .forEach(([o, v, s]) => (s === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const makeXlsxBlob = (rows, { sheetName = 'Sheet1', widths = [] } = {}) => {
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => `<c r="${COLS[ci]}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join('');
  return zip([
    { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: 'xl/worksheets/sheet1.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}">${cols}<sheetData>${body}</sheetData></worksheet>` },
  ]);
};

export const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
