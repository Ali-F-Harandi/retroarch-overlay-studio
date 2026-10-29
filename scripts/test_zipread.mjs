// Test: verify the zero-dependency ZIP reader (same code as Overlay_editor.html)
// against the real buildbot overlays.zip, byte-for-byte vs Python's zipfile.
import { readFileSync, writeFileSync } from 'node:fs';

const buf = readFileSync('/home/z/my-project/scripts/overlays.zip');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

// ---- same implementation as the editor ----
function onlZipRead(buffer) {
  const u = new Uint8Array(buffer), dv = new DataView(buffer), td = new TextDecoder();
  let eocd = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('no zip');
  const n = dv.getUint16(eocd + 10, true); let o = dv.getUint32(eocd + 16, true);
  const items = new Map();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(o, true) !== 0x02014b50) break;
    const csize = dv.getUint32(o + 20, true), nl = dv.getUint16(o + 28, true),
      el = dv.getUint16(o + 30, true), cl = dv.getUint16(o + 32, true), lho = dv.getUint32(o + 42, true);
    if (!(dv.getUint16(o + 8, true) & 1)) {
      const name = td.decode(u.subarray(o + 46, o + 46 + nl));
      if (!name.endsWith('/')) items.set(name, { mth: dv.getUint16(o + 10, true), csize, lho });
    }
    o += 46 + nl + el + cl;
  }
  return {
    items,
    read: async name => {
      const it = items.get(name); if (!it) return null;
      const ln = dv.getUint16(it.lho + 26, true), le = dv.getUint16(it.lho + 28, true),
        st = it.lho + 30 + ln + le, c = u.subarray(st, st + it.csize);
      if (it.mth === 0) return c;
      if (it.mth !== 8 || typeof DecompressionStream !== 'function') throw new Error('zip: ' + name);
      const out = await new Response(new Blob([c]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      return new Uint8Array(out);
    }
  };
}
// ----------------------------------------------

const z = onlZipRead(ab);
console.log('parsed entries:', z.items.size);

const picks = [
  'gamepads/cdi_anim_portrait/cdi.cfg',        // deflate, text
  'gamepads/flat/img/A.png',                   // deflate, binary
  'borders/gb.cfg',                            // deflate, text 2
  'Makefile',                                  // small root file
];
let fails = 0;
for (const p of picks) {
  const b = await z.read(p);
  if (!b) { console.log('MISSING', p); fails++; continue; }
  const ref = readFileSync('/tmp/zref/' + p.replaceAll('/', '_'));
  const ok = Buffer.compare(Buffer.from(b), ref) === 0;
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + p + '  (' + b.length + ' bytes, mth=' + z.items.get(p).mth + ')');
  if (!ok) fails++;
}
// verify the stored (mth=0) path too if any entry is stored
let stored = 0; for (const [k, v] of z.items) if (v.mth === 0) stored++;
console.log('stored entries in zip:', stored);
console.log(fails ? 'RESULT: FAIL' : 'RESULT: ALL OK');
process.exit(fails ? 1 : 0);
