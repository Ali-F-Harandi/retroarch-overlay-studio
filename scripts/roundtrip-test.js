/* Round-trip test: parse & re-serialize every official cfg, check idempotency */
const fs = require('fs');
const path = require('path');

// transpile-free: copy the pure TS logic essentials as JS
const DESC_MAIN = /^overlay(\d+)_desc(\d+)\s*=\s*"(.*)"\s*$/;
const DESC_EXTRA = /^overlay(\d+)_desc(\d+)_(\w+)\s*=\s*(.*)$/;
const OVERLAY_PROP = /^overlay(\d+)_(\w+)\s*=\s*(.*)$/;
const TOP_PROP = /^([A-Za-z_]\w*)\s*=\s*(.*)$/;
const COUNT = /^overlays\s*=\s*(\d+)\s*$/;
const unquote = (s) => s.replace(/^"(.*)"$/s, '$1');
const num = (s) => { const n = parseFloat((s ?? '').trim()); return Number.isFinite(n) ? n : 0; };

function parseCfg(text) {
  const top = [], ovMap = new Map();
  const get = (n) => { let o = ovMap.get(n); if (!o) { o = { props: [], descs: [] }; ovMap.set(n, o); } return o; };
  let declared = 0;
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let m;
    if ((m = DESC_MAIN.exec(line))) {
      const o = get(+m[1]); const f = m[3].split(',');
      while (o.descs.length <= +m[2]) o.descs.push({ name: '', x: 0, y: 0, w: 0, h: 0, shape: 'radial', extra: {} });
      const d = o.descs[+m[2]];
      d.name = (f[0] ?? 'nul').trim(); d.x = num(f[1]); d.y = num(f[2]);
      d.shape = (f[3] ?? 'radial').trim() === 'rect' ? 'rect' : 'radial';
      d.w = num(f[4]); d.h = num(f[5]);
      continue;
    }
    if ((m = DESC_EXTRA.exec(line))) {
      const o = get(+m[1]);
      while (o.descs.length <= +m[2]) o.descs.push({ name: '', x: 0, y: 0, w: 0, h: 0, shape: 'radial', extra: {} });
      const d = o.descs[+m[2]];
      const k = m[3], v = m[4].trim();
      const known = ['overlay', 'range_mod', 'range_mod_exclusive', 'reach_x', 'reach_y', 'reach_up', 'reach_down', 'reach_left', 'reach_right', 'next_target', 'exclusive'];
      if (known.includes(k)) d[k === 'overlay' ? 'image' : k.replace(/_(.)/g, (_, c) => c.toUpperCase())] = (k === 'next_target' || k === 'overlay') ? unquote(v) : v;
      else d.extra[k] = v;
      continue;
    }
    if ((m = OVERLAY_PROP.exec(line))) { if (m[2] !== 'descs') get(+m[1]).props.push([m[2], m[3].trim()]); continue; }
    if ((m = COUNT.exec(line))) { declared = +m[1]; continue; }
    if ((m = TOP_PROP.exec(line))) top.push([m[1], m[2].trim()]);
  }
  const overlays = [...ovMap.entries()].sort((a, b) => a[0] - b[0]).map(([, o]) => o);
  while (overlays.length < declared) overlays.push({ props: [], descs: [] });
  overlays.forEach((o) => { o.descs = o.descs.filter((d) => d.name !== '' || d.w !== 0); });
  return { top, overlays };
}

const f5 = (v) => { const s = (Math.round(v * 1e5) / 1e5).toFixed(5); return s === '-0.00000' ? '0.00000' : s; };

function serializeCfg(m) {
  const out = [];
  for (const [k, v] of m.top) out.push(`${k} = ${v}`);
  out.push(`overlays = ${m.overlays.length}`);
  m.overlays.forEach((o, i) => {
    out.push('');
    for (const [k, v] of o.props) out.push(`overlay${i}_${k} = ${v}`);
    out.push(''); out.push(`overlay${i}_descs = ${o.descs.length}`); out.push('');
    o.descs.forEach((d, j) => {
      out.push(`overlay${i}_desc${j} = "${d.name},${f5(d.x)},${f5(d.y)},${d.shape},${f5(d.w)},${f5(d.h)}"`);
      const kv = [['overlay', d.image], ['range_mod', d.rangeMod], ['range_mod_exclusive', d.rangeModExclusive],
        ['reach_x', d.reachX], ['reach_y', d.reachY], ['reach_up', d.reachUp], ['reach_down', d.reachDown],
        ['reach_left', d.reachLeft], ['reach_right', d.reachRight], ['next_target', d.nextTarget], ['exclusive', d.exclusive]];
      for (const [k, v] of kv) if (v !== undefined && v !== '') out.push(`overlay${i}_desc${j}_${k} = ${v}`);
      for (const [k, v] of Object.entries(d.extra)) out.push(`overlay${i}_desc${j}_${k} = ${v}`);
    });
  });
  return out.join('\n') + '\n';
}

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(abs));
    else if (e.name.endsWith('.cfg')) out.push(abs);
  }
  return out;
}

const files = walk('/home/z/my-project/public/presets');
let ok = 0, drift = 0, empty = 0, crash = 0;
let worst = null, worstDiff = 0;
for (const f of files) {
  try {
    const text = fs.readFileSync(f, 'utf8');
    const m1 = parseCfg(text);
    const s1 = serializeCfg(m1);
    const m2 = parseCfg(s1);
    const s2 = serializeCfg(m2);
    if (s1 !== s2) {
      drift++;
      if (!worst) worst = f;
    }
    if (m1.overlays.every((o) => o.descs.length === 0)) empty++;
    else ok++;
  } catch (e) {
    crash++;
    console.log('CRASH', f, e.message);
  }
}
console.log(`total=${files.length} parsedWithDescs=${ok} emptyDescs=${empty} drift=${drift} crash=${crash}`);
if (worst) console.log('first drift:', worst);

// show a sample round-trip of a complex file
const sample = '/home/z/my-project/public/presets/gamepads/Named_Overlays/Atari - 2600.cfg';
const t = fs.readFileSync(sample, 'utf8');
const s1 = serializeCfg(parseCfg(t));
const origLines = t.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length;
const newLines = s1.split('\n').length;
console.log(`sample: orig active lines=${origLines} roundtrip lines=${newLines}`);
console.log(s1.split('\n').slice(0, 28).join('\n'));
