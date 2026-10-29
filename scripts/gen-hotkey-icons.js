#!/usr/bin/env node
/**
 * Generate the dedicated "hotkey" icons that the user's original single-file
 * HTML editor (upload/Overlay_editor.html, mkIcon()) created for quick
 * save / quick load / rewind / slow-motion buttons.
 *
 * Same visual language: 128x128 transparent canvas, white ring, white glyph.
 * Output:
 *   public/presets/gamepads/flat/img/hotkey_<fn>.png   (referenced by the custom console presets)
 *   public/buttons/hotkey-<kebab>.png                  (editor "Add element" art catalog)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('/home/z/my-project/node_modules/sharp');

const RING = '<circle cx="64" cy="64" r="57" fill="none" stroke="#fff" stroke-width="7"/>';
const STROKE_OPEN = '<g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">';
const FILL_OPEN = '<g fill="#fff" stroke="none">';

/** glyph builders — ported 1:1 from mkIcon() in the original HTML editor */
const GLYPHS = {
  save_state: `${STROKE_OPEN}<path d="M34 78v14h60V78"/><path d="M64 34v40M46 58l18 18 18-18"/></g>`,
  load_state: `${STROKE_OPEN}<path d="M34 78v14h60V78"/><path d="M64 76V36M46 52l18-18 18 18"/></g>`,
  rewind: `${FILL_OPEN}<path d="M94 42L64 64L94 86ZM64 42L34 64L64 86Z"/></g>`,
  toggle_fast_forward: `${FILL_OPEN}<path d="M34 42L64 64L34 86ZM64 42L94 64L64 86Z"/></g>`,
  pause_toggle: `${FILL_OPEN}<rect x="42" y="38" width="16" height="52"/><rect x="70" y="38" width="16" height="52"/></g>`,
  menu_toggle: `${STROKE_OPEN}<path d="M36 46h56M36 64h56M36 82h56"/></g>`,
  screenshot: `${STROKE_OPEN}<rect x="32" y="50" width="64" height="42"/><path d="M50 50l6-10h16l6 10"/><circle cx="64" cy="71" r="12"/></g>`,
  state_slot_increase: `${FILL_OPEN}<text x="64" y="66" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="24">SLOT+</text></g>`,
  state_slot_decrease: `${FILL_OPEN}<text x="64" y="66" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="24">SLOT&#8722;</text></g>`,
  toggle_slowmotion: `${FILL_OPEN}<text x="64" y="66" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="30">SLOW</text></g>`,
};

const svg = (fn) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${RING}${GLYPHS[fn]}</svg>`;

const kebab = (s) => s.replace(/_/g, '-');

async function main() {
  const flatDir = '/home/z/my-project/public/presets/gamepads/flat/img';
  const btnDir = '/home/z/my-project/public/buttons';
  fs.mkdirSync(flatDir, { recursive: true });
  fs.mkdirSync(btnDir, { recursive: true });

  // icons referenced by the custom console presets (underscore names)
  const flatSet = ['save_state', 'load_state', 'rewind', 'toggle_slowmotion'];
  // full set for the editor art catalog (kebab names)
  const btnSet = Object.keys(GLYPHS);

  for (const fn of flatSet) {
    const out = path.join(flatDir, `hotkey_${fn}.png`);
    await sharp(Buffer.from(svg(fn))).png().toFile(out);
    console.log('flat/img/', path.basename(out));
  }
  for (const fn of btnSet) {
    const out = path.join(btnDir, `hotkey-${kebab(fn)}.png`);
    await sharp(Buffer.from(svg(fn))).png().toFile(out);
    console.log('buttons/', path.basename(out));
  }
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
