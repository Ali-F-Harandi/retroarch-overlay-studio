# Overlay Studio — RetroArch Overlay Editor

A fast, modern, **100% client-side** editor for RetroArch controller overlays.
Load official presets, drag & resize buttons on a live canvas, tune touch
hitboxes with **correct `range_mod` handling**, and export a ready-to-use
`.cfg` with all artwork.

**Live app:** https://ali-f-harandi.github.io/retroarch-overlay-studio/ (after Pages deployment)

![RetroArch](https://img.shields.io/badge/RetroArch-overlay%20editor-teal) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![License](https://img.shields.io/badge/code-MIT-green)

## Features

- **Visual canvas editor** — drag to move, corner handles to resize, marquee
  select, multi-select (Shift+click), group scaling, grid + snap with center
  guides, arrow-key nudging.
- **Official presets bundled offline** — all **312 overlay configs** and ~2,200
  artwork files from the libretro buildbot, browsable by category with
  thumbnails and search. No network needed, no CORS pain.
- **Correct `range_mod` model** — the graphic always renders at the desc
  `w × h`; `range_mod` only enlarges the *touch area* while pressed
  (per-element values override the page-level value). A toggleable hitbox view
  shows the expanded zones.
- **Pixel & normalized coordinates** — legacy pixel-space overlays are
  auto-normalized on load using the page background image dimensions.
- **Full fidelity import/export** — unknown `.cfg` keys
  (`saturate_pct`, `movable`, `reach_*`, custom keys…) are preserved verbatim
  through edit round-trips. Export as `.cfg`, or as a **ZIP** with all
  referenced artwork flattened into `img/`.
- **Multi-page overlays** — page tabs (landscape / portrait / hidden / menu
  variants), add / duplicate / delete, and "copy geometry" to keep variants
  aligned.
- **Live preview** — fullscreen simulator with multi-touch hit-testing,
  pressed-button feedback and hitbox guides.
- **Session autosave** — work is restored after a reload; images you upload
  are matched to elements by relative path or filename.
- **Keyboard shortcuts** — `Ctrl+Z / Ctrl+Y` undo/redo, `Ctrl+D` duplicate,
  `Del` delete, arrows nudge (`Shift` = ×8), `Esc` clear selection.

## Getting started

```bash
bun install        # or: npm install
bun dev            # development server on :3000
```

### Build for GitHub Pages (static export)

```bash
NEXT_STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/retroarch-overlay-studio bun run build:pages
# output is written to ./out
```

Deployment is automated: every push to `main` runs the GitHub Actions
workflow in `.github/workflows/deploy.yml`, which builds the static export
and publishes it to GitHub Pages.

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui, Lucide icons
- Zustand state with full undo/redo history
- fflate for ZIP export
- No backend — everything runs in the browser

## Project layout

```
src/lib/cfg.ts            cfg parser / serializer, input catalog, geometry
src/lib/store.ts          editor state (zustand) + history + image library
src/lib/presets.ts        bundled preset index helpers
src/components/editor/    canvas, elements panel, properties panel, page tabs
src/components/           top bar, preset browser, preview, help dialog
public/presets/           official libretro overlay assets + index.json
scripts/                  asset pipeline & round-trip test utilities
```

## Licenses

- Application code: **MIT** (see `LICENSE`)
- Bundled overlay assets: from
  [libretro buildbot](https://buildbot.libretro.com/assets/frontend/overlays.zip),
  licensed **CC-BY-4.0** (see `public/presets/COPYING`)

## Credits

Built as a modern rewrite of a single-file RetroArch overlay editor,
using the official [libretro overlay assets](https://github.com/libretro/overlays).
