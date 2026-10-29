#!/usr/bin/env node
/**
 * Build public/presets from the official libretro overlay assets and generate
 * public/presets/index.json used by the Preset Browser.
 *
 * Source: /tmp/overlays_extract (unzipped buildbot overlays.zip)
 * Skips build system files (Makefile, configure, *.sh, *.py, *.ps1, *.out, tests)
 */
const fs = require('fs');
const path = require('path');

const SRC = '/tmp/overlays_extract';
const DST = '/home/z/my-project/public/presets';
const SKIP_FILES = new Set(['Makefile', 'configure', 'README.md', 'README']);
const SKIP_EXT = new Set(['.sh', '.py', '.ps1', '.out', '.o', '.txt']);

function walk(dir, base = '') {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + e.name : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'test' || e.name === 'tests') continue;
      out = out.concat(walk(abs, rel));
    } else {
      if (SKIP_FILES.has(e.name) || SKIP_EXT.has(path.extname(e.name).toLowerCase())) continue;
      out.push({ rel, abs });
    }
  }
  return out;
}

const descRe = /^overlay(\d+)_desc(\d+)\s*=\s*"(.*)"\s*$/;
const imgRe = /^overlay(\d+)_desc(\d+)_overlay\s*=\s*(.*)$/;
const nameRe = /^overlay(\d+)_name\s*=\s*"?(.*?)"?\s*$/;
const descsRe = /^overlay(\d+)_descs\s*=\s*(\d+)\s*$/;
const countRe = /^overlays\s*=\s*(\d+)\s*$/;

function analyzeCfg(text) {
  let overlays = 0, descs = 0, firstImg = null;
  const names = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let m;
    if ((m = countRe.exec(line))) overlays = parseInt(m[1]) || overlays;
    else if ((m = descsRe.exec(line))) descs += parseInt(m[2]) || 0;
    else if ((m = nameRe.exec(line))) names.push(m[2]);
    else if (!firstImg && (m = imgRe.exec(line))) {
      let v = m[3].trim().replace(/^"|"$/g, '');
      if (v && !/^nul$/i.test(v)) firstImg = v;
    }
  }
  return { overlays, descs, names, firstImg };
}

// resolve a relative image ref like ../flat/img/A.png against the cfg's dir
function resolveRef(cfgDir, ref) {
  const parts = (cfgDir ? cfgDir.split('/') : []).concat(ref.split('/'));
  const st = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') st.pop();
    else st.push(p);
  }
  return st.join('/');
}

function main() {
  if (!fs.existsSync(SRC)) { console.error('source missing: ' + SRC); process.exit(1); }
  fs.rmSync(DST, { recursive: true, force: true });
  fs.mkdirSync(DST, { recursive: true });

  const entries = walk(SRC);
  const cats = new Map();
  let copied = 0, bytes = 0;
  for (const { rel, abs } of entries) {
    const top = rel.split('/')[0];
    const stat = fs.statSync(abs);
    bytes += stat.size;
    if (!cats.has(top)) cats.set(top, { cfgs: [] });
    const dst = path.join(DST, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(abs, dst);
    copied++;
    if (rel.endsWith('.cfg')) {
      const topDir = rel.includes('/') ? rel.split('/')[0] : null;
      if (!topDir) continue; // skip loose top-level cfgs
      const text = fs.readFileSync(abs, 'utf8');
      const info = analyzeCfg(text);
      const cfgDir = path.dirname(rel);
      cats.get(topDir).cfgs.push({
        name: path.basename(rel, '.cfg'),
        file: path.basename(rel),
        path: rel,
        dir: cfgDir === '.' ? '' : cfgDir,
        overlays: info.overlays,
        descs: info.descs,
        names: info.names.slice(0, 8),
        thumb: info.firstImg ? resolveRef(cfgDir, info.firstImg) : null,
      });
    }
  }

  const index = {
    generated: new Date().toISOString(),
    source: 'https://buildbot.libretro.com/assets/frontend/overlays.zip',
    license: 'CC-BY-4.0 (see presets/COPYING)',
    categories: [...cats.entries()]
      .filter(([, c]) => c.cfgs.length > 0)
      .map(([id, c]) => ({
      id,
      count: c.cfgs.length,
      cfgs: c.cfgs.sort((a, b) => a.name.localeCompare(b.name)),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  fs.writeFileSync(path.join(DST, 'index.json'), JSON.stringify(index, null, 1));
  console.log(`copied ${copied} files (${(bytes / 1048576).toFixed(1)} MB), ${index.categories.length} categories, ${index.categories.reduce((s, c) => s + c.count, 0)} cfgs`);
}

main();
