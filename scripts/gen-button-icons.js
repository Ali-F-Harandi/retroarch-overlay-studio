// Draw the 3 missing default button icons in the same white-line style as the
// RetroArch "flat" pack (white strokes, transparent background) → public/buttons/
const sharp = require('/home/z/my-project/node_modules/sharp');
const path = require('path');

const OUT = '/home/z/my-project/public/buttons';
const W = 256, STROKE = 14, COL = '#ffffff';

function circleWrap(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <circle cx="${W / 2}" cy="${W / 2}" r="${W / 2 - STROKE}" fill="none" stroke="${COL}" stroke-width="${STROKE}"/>
  ${inner}
</svg>`;
}

const icons = {
  // rewind: two left-pointing triangles inside the flat-style circle
  'rewind.png': circleWrap(`
    <path d="M ${W / 2 + 28} ${W / 2 - 40} L ${W / 2 - 22} ${W / 2} L ${W / 2 + 28} ${W / 2 + 40} Z" fill="${COL}"/>
    <path d="M ${W / 2 - 22} ${W / 2 - 40} L ${W / 2 - 72} ${W / 2} L ${W / 2 - 22} ${W / 2 + 40} Z" fill="${COL}"/>`),
  // overlay next: two stacked rounded pages
  'overlay-next.png': circleWrap(`
    <rect x="${W / 2 - 14}" y="${W / 2 - 46}" width="62" height="72" rx="10" fill="none" stroke="${COL}" stroke-width="${STROKE - 3}"/>
    <rect x="${W / 2 - 48}" y="${W / 2 - 26}" width="62" height="72" rx="10" fill="#000000" stroke="${COL}" stroke-width="${STROKE - 3}"/>`),
  // on-screen keyboard
  'osk.png': circleWrap(`
    <rect x="${W / 2 - 60}" y="${W / 2 - 38}" width="120" height="76" rx="10" fill="none" stroke="${COL}" stroke-width="${STROKE - 3}"/>
    ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${W / 2 - 48 + c * 26}" y="${W / 2 - 26 + r * 18}" width="16" height="9" rx="2" fill="${COL}"/>`).join('')).join('')}
    <rect x="${W / 2 - 34}" y="${W / 2 + 26}" width="68" height="9" rx="2" fill="${COL}"/>`),
};

(async () => {
  for (const [name, svg] of Object.entries(icons)) {
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, name));
    console.log('wrote', name);
  }
})();
