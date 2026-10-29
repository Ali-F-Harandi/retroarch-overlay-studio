#!/usr/bin/env node
/** Add the custom console presets to public/presets/index.json (gamepads category). */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/public/presets';
const FILES = [
  'Nintendo - Game Boy.cfg',
  'Nintendo - Game Boy Advance.cfg',
  'Nintendo - NES.cfg',
  'Sega - Genesis.cfg',
  'Nintendo - SNES.cfg',
];

const nameRe = /^overlay(\d+)_name\s*=\s*"?([^"\n]+)"?/;
const descsRe = /^overlay(\d+)_descs\s*=\s*(\d+)/;
const imgRe = /^overlay(\d+)_desc(\d+)_overlay\s*=/;

const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'index.json'), 'utf8'));
const gamepads = index.categories.find((c) => c.id === 'gamepads');
if (!gamepads) { console.error('gamepads category missing'); process.exit(1); }

const existing = new Set(gamepads.cfgs.map((c) => c.path));
let added = 0;
for (const file of FILES) {
  const rel = 'gamepads/flat/' + file;
  if (existing.has(rel)) { console.log('skip (exists):', rel); continue; }
  const text = fs.readFileSync(path.join(ROOT, 'gamepads/flat', file), 'utf8');
  const names = [];
  let descs = 0;
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    let m;
    if ((m = nameRe.exec(l))) names.push(m[2]);
    else if ((m = descsRe.exec(l))) descs += parseInt(m[2]) || 0;
  }
  gamepads.cfgs.push({
    name: file.replace(/\.cfg$/i, ''),
    file,
    path: rel,
    dir: 'gamepads/flat',
    overlays: names.length,
    descs,
    names,
    thumb: '.thumbs/gamepads/flat/' + file.replace(/\.cfg$/i, '') + '.png',
  });
  added++;
}
gamepads.count = gamepads.cfgs.length;
fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify(index, null, 1));
console.log(`added ${added} preset entries; gamepads count now ${gamepads.count}`);
