/* Minimal ZIP writer (stored, no compression: JPEGs do not shrink). UTF-8 file names.
 * makeZip([{ name, data: Uint8Array }]) -> Uint8Array */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(u8) {
  let c = ~0;
  for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return ~c >>> 0;
}

export function makeZip(files) {
  const enc = new TextEncoder(), d = new Date();
  const time = d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1;
  const date = (d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
    const head = (sig, extra) => {
      const b = new DataView(new ArrayBuffer(extra ? 46 : 30));
      let p = 0;
      const u16 = v => { b.setUint16(p, v, true); p += 2; }, u32 = v => { b.setUint32(p, v, true); p += 4; };
      u32(sig); if (extra) u16(20);
      u16(20); u16(0x0800); u16(0); u16(time); u16(date); u32(crc); u32(n); u32(n); u16(name.length); u16(0);
      if (extra) { u16(0); u16(0); u16(0); u32(0); u32(offset); }
      return new Uint8Array(b.buffer);
    };
    central.push(head(0x02014b50, true), name);
    const local = head(0x04034b50, false);
    parts.push(local, name, f.data);
    offset += local.length + name.length + n;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
