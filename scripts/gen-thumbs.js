#!/usr/bin/env node
/**
 * Generate real composite preview thumbnails for every bundled preset .cfg.
 *
 * For each cfg we pick its most representative overlay page and render it the
 * same way RetroArch does: page background stretched to the canvas, then every
 * desc image placed at (x,y) center with (w,h) half-extents — normalized 0..1
 * (pixel-space cfgs are normalized against the background image size first).
 * Cfgs without a background get dark canvas + hitbox outlines + name labels.
 *
 * Output: public/presets/.thumbs/<cfg-path>.jpg|.png  +  index.json thumb fields.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('/home/z/my-project/node_modules/sharp');

const ROOT = '/home/z/my-project/public/presets';
const THUMBS = path.join(ROOT, '.thumbs');
const W = 480;
const INDEX = path.join(ROOT, 'index.json');

function walkCfgs(dir, base = '') {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.thumbs' || e.name.startsWith('.')) continue;
    const rel = base ? base + '/' + e.name : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkCfgs(abs, rel));
    else if (e.name.toLowerCase().endsWith('.cfg')) out.push({ rel, abs });
  }
  return out;
}

/** parse the subset of cfg syntax needed for rendering */
function parseCfg(text) {
  const overlays = new Map();
  const ov = (n) => {
    let o = overlays.get(n);
    if (!o) { o = { bg: null, descs: [], normalized: false }; overlays.set(n, o); }
    return o;
  };
  const descMain = /^overlay(\d+)_desc(\d+)\s*=\s*"(.*)"\s*$/;
  const descImg = /^overlay(\d+)_desc(\d+)_overlay\s*=\s*(.*)$/;
  const ovBg = /^overlay(\d+)_overlay\s*=\s*(.*)$/;
  const ovNorm = /^overlay(\d+)_normalized\s*=\s*(.*)$/;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let m;
    if ((m = descMain.exec(line))) {
      const f = m[3].split(',');
      ov(+m[1]).descs[+m[2]] = {
        name: (f[0] ?? '').trim(),
        x: parseFloat(f[1]) || 0, y: parseFloat(f[2]) || 0,
        shape: (f[3] ?? 'radial').trim() === 'rect' ? 'rect' : 'radial',
        w: parseFloat(f[4]) || 0, h: parseFloat(f[5]) || 0,
        img: null,
      };
    } else if ((m = descImg.exec(line))) {
      const v = m[3].trim().replace(/^"|"$/g, '');
      if (v && !/^nul$/i.test(v)) { const o = ov(+m[1]); while (o.descs.length <= +m[2]) o.descs.push({ img: null }); o.descs[+m[2]].img = v; }
    } else if ((m = ovBg.exec(line))) {
      const v = m[2].trim().replace(/^"|"$/g, '');
      if (v && !/^nul$/i.test(v)) ov(+m[1]).bg = v;
    } else if ((m = ovNorm.exec(line))) {
      ov(+m[1]).normalized = m[2].trim().toLowerCase() === 'true';
    }
  }
  return [...overlays.entries()].sort((a, b) => a[0] - b[0]).map(([, o]) => o);
}

/** resolve ../ relative refs against the cfg dir (same as app resolveImgRef) */
function resolveRef(cfgDir, ref) {
  const parts = (cfgDir ? cfgDir.split('/') : []).concat(ref.replace(/\\/g, '/').split('/'));
  const st = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') st.pop(); else st.push(p);
  }
  return st.join('/');
}

const dimCache = new Map();
async function imgDims(abs) {
  if (dimCache.has(abs)) return dimCache.get(abs);
  try {
    const d = await sharp(abs).metadata();
    const r = { w: d.width, h: d.height };
    dimCache.set(abs, r);
    return r;
  } catch { return null; }
}

const bufCache = new Map();
async function resizedBuf(abs, w, h) {
  const key = abs + '|' + w + 'x' + h;
  if (bufCache.has(key)) return bufCache.get(key);
  const buf = await sharp(abs).resize(w, h, { fit: 'fill' }).png().toBuffer();
  bufCache.set(key, buf);
  return buf;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** choose the overlay page that best represents the preset */
function pickOverlay(pages) {
  let best = null, bestScore = -1;
  for (const p of pages) {
    const nDesc = p.descs.filter(Boolean).length;
    let score = 0;
    if (p.bg) score += 2;
    if (nDesc) score += 1 + Math.min(nDesc, 20) / 40;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best && bestScore > 0 ? best : null;
}

async function renderThumb(rel, abs) {
  const text = fs.readFileSync(abs, 'utf8');
  const pages = parseCfg(text);
  const page = pickOverlay(pages);
  if (!page) return null;

  const cfgDir = path.dirname(rel);
  const bgAbs = page.bg ? path.join(ROOT, resolveRef(cfgDir, page.bg)) : null;
  const bgDim = bgAbs && fs.existsSync(bgAbs) ? await imgDims(bgAbs) : null;

  // pixel-space normalization reference: background pixel size
  const pixelSpace = !page.normalized && page.descs.some((d) => d && (d.x > 1.5 || d.y > 1.5 || d.w > 1.5 || d.h > 1.5));

  let H = 270;
  if (bgDim) {
    const aspect = Math.min(2.4, Math.max(0.45, bgDim.w / bgDim.h));
    H = Math.round(W / aspect / 2) * 2;
  }

  const layers = [];
  const boxes = []; // hitbox outlines for descs without images
  const base = { w: bgDim ? bgDim.w : W, h: bgDim ? bgDim.h : H }; // normalization reference

  for (const d of page.descs) {
    if (!d || (!d.name && !d.img)) continue;
    let x = d.x, y = d.y, w = d.w, h = d.h;
    if (pixelSpace && bgDim) { x /= base.w; y /= base.h; w /= base.w; h /= base.h; }
    if (d.img) {
      const imgAbs = path.join(ROOT, resolveRef(cfgDir, d.img));
      if (!fs.existsSync(imgAbs)) continue;
      const sw = Math.max(1, Math.round(w * 2 * W));
      const sh = Math.max(1, Math.round(h * 2 * H));
      if (sw < 2 || sh < 2) continue;
      // clip to canvas (descs can extend past the edge)
      const x0 = x * W - sw / 2, y0 = y * H - sh / 2;
      const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0);
      const cx1 = Math.min(W, x0 + sw), cy1 = Math.min(H, y0 + sh);
      if (cx1 <= cx0 || cy1 <= cy0) continue;
      try {
        const buf = await resizedBuf(imgAbs, sw, sh);
        layers.push({ input: buf, left: Math.round(cx0), top: Math.round(cy0) });
      } catch { /* skip bad image */ }
    } else if (d.name && d.name !== 'nul') {
      boxes.push({ x, y, w, h, shape: d.shape, name: d.name });
    }
  }

  const thumbBase = rel.replace(/\.cfg$/i, '');
  const outFile = thumbBase + (bgDim ? '.jpg' : '.png');
  const outAbs = path.join(THUMBS, outFile);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  if (bgDim) {
    const bgBuf = await sharp(bgAbs).resize(W, H, { fit: 'fill' }).png().toBuffer();
    await sharp(bgBuf).composite(layers).jpeg({ quality: 82 }).toFile(outAbs);
  } else {
    // dark canvas + desc images + hitbox outlines + labels
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      ${boxes.map((b) => b.shape === 'rect'
        ? `<rect x="${(b.x - b.w) * W}" y="${(b.y - b.h) * H}" width="${b.w * 2 * W}" height="${b.h * 2 * H}" rx="4" fill="rgba(45,212,191,.12)" stroke="#2dd4bf" stroke-width="1.5"/>`
        : `<ellipse cx="${b.x * W}" cy="${b.y * H}" rx="${b.w * W}" ry="${b.h * H}" fill="rgba(45,212,191,.12)" stroke="#2dd4bf" stroke-width="1.5"/>`).join('')}
      ${boxes.length <= 10 ? boxes.map((b) => `<text x="${b.x * W}" y="${b.y * H + 4}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="12" fill="#d4d4d8">${esc(b.name)}</text>`).join('') : ''}
    </svg>`;
    await sharp({ create: { width: W, height: H, channels: 4, background: { r: 24, g: 24, b: 27, alpha: 1 } } })
      .composite([...layers, { input: Buffer.from(svg) }])
      .png({ compressionLevel: 9 })
      .toFile(outAbs);
  }
  return '.thumbs/' + outFile;
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(THUMBS, { recursive: true });
  const cfgs = walkCfgs(ROOT);
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const byPath = new Map(index.categories.flatMap((c) => c.cfgs).map((c) => [c.path, c]));

  let done = 0, fail = 0, noVisual = 0;
  const CONCURRENCY = 8;
  const queue = [...cfgs];
  async function worker() {
    while (queue.length) {
      const { rel, abs } = queue.shift();
      const entry = byPath.get(rel);
      try {
        const thumb = await renderThumb(rel, abs);
        if (thumb) { if (entry) entry.thumb = thumb; done++; }
        else { if (entry) entry.thumb = null; noVisual++; }
      } catch (e) {
        fail++;
        console.error('FAIL', rel, e.message);
        if (entry) entry.thumb = null;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
  const du = execSize(THUMBS);
  console.log(`thumbs: ${done} rendered, ${noVisual} without visuals, ${fail} failed — ${du} in ${(Date.now() - t0) / 1000 | 0}s`);
}

function execSize(p) {
  let n = 0;
  for (const f of fs.readdirSync(p)) n += fs.statSync(path.join(p, f)).size;
  return (n / 1048576).toFixed(1) + ' MB';
}

main();
