'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, ASPECTS } from '@/lib/store';
import { serializeCfg } from '@/lib/cfg';
import { saveSession } from '@/lib/persist';
import { presetsFileUrl } from '@/lib/presets';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Undo2, Redo2, Sparkles, Play, FolderOpen, Save, FilePlus2, Images, Package,
  KeyboardIcon, Grid3x3, Grid2x2, Magnet, Scan, Loader2, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { zipSync } from 'fflate';

function download(name: string, data: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 2000);
}

const readFile = (f: File, as: 'text' | 'url') =>
  as === 'text' ? f.text() : new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });

/** selectable snap-grid steps (fraction of screen width/height) */
const STEPS = [0.01, 0.02, 0.025, 0.05, 0.1, 0.125, 0.25];
const stepLabel = (v: number) => `${+(v * 100).toFixed(2)}%`;

export default function TopBar() {
  const s = useEditor();
  const cfgInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const [zipping, setZipping] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false); // mobile tools sheet

  /** close the mobile sheet, then run the action (file inputs need a settled gesture) */
  const act = (fn: () => void) => {
    setToolsOpen(false);
    setTimeout(fn, 120);
  };

  // autosave (debounced)
  useEffect(() => {
    if (!s.loaded) return;
    const t = setTimeout(() => {
      saveSession(s.fileName, s.model, s.lib, {
        aspect: s.aspect, gridStep: s.gridStep, showGrid: s.showGrid, snapOn: s.snapOn, showHitbox: s.showHitbox,
      });
    }, 800);
    return () => clearTimeout(t);
  }, [s.loaded, s.fileName, s.model, s.lib, s.aspect, s.gridStep, s.showGrid, s.snapOn, s.showHitbox]);

  const importImages = async (fl: FileList) => {
    const files = [...fl].filter((f) => /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(f.name) || f.type.startsWith('image/'));
    if (!files.length) {
      toast.error('No images found in the selection');
      return;
    }
    const imgs = await Promise.all(
      files.map(async (f) => {
        const url = await readFile(f, 'url');
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        return { rel, name: f.name, url };
      }),
    );
    s.addLibImages(imgs);
    toast.success(`Imported ${imgs.length} image${imgs.length === 1 ? '' : 's'}`, {
      description: 'They are matched to elements by relative path / file name.',
    });
  };

  const saveCfg = () => {
    const name = s.fileName.endsWith('.cfg') ? s.fileName : s.fileName + '.cfg';
    download(name, new Blob([serializeCfg(s.model)], { type: 'application/octet-stream' }));
    toast.success('Saved ' + name);
  };

  const exportZip = async () => {
    setZipping(true);
    try {
      const base = s.fileName.replace(/\.cfg$/i, '') || 'overlay';
      const zip: Record<string, Uint8Array> = {};
      const cfgText = serializeCfg(s.model);
      zip[`${base}.cfg`] = new TextEncoder().encode(cfgText);

      // collect every image ref used in the model, resolve to bytes
      const wanted = new Map<string, string>(); // rel ref -> rel name
      for (const o of s.model.overlays) {
        for (const d of o.descs) {
          if (!d.image) continue;
          const key = d.image.toLowerCase();
          if (!wanted.has(key)) wanted.set(key, d.image);
        }
      }
      const fail: string[] = [];
      for (const [, ref] of wanted) {
        const libHit = s.lib.find((l) => l.rel.toLowerCase() === ref.toLowerCase());
        try {
          let bytes: Uint8Array | null = null;
          if (libHit && !libHit.builtin) {
            const blob = await (await fetch(libHit.url)).blob();
            bytes = new Uint8Array(await blob.arrayBuffer());
          } else if (libHit?.builtin) {
            const res = await fetch(libHit.url);
            if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
          }
          if (!bytes) {
            // try builtin preset path
            const res = await fetch(presetsFileUrl(ref));
            if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
          }
          if (!bytes) { fail.push(ref); continue; }
          // flatten: keep basename to avoid ../ paths in zip
          const flatName = ref.split('/').pop()!;
          zip[`img/${flatName}`] = bytes;
        } catch {
          fail.push(ref);
        }
      }
      if (Object.keys(zip).length > 1) {
        // rewrite cfg image refs to flat img/ folder
        const rewritten = cfgText.replace(/(overlay\d+_desc\d+_overlay\s*=\s*)(.+)/g, (_m, p1, p2) => {
          const ref = p2.trim().replace(/^"|"$/g, '');
          if (!ref) return _m;
          return `${p1}img/${ref.split('/').pop()}`;
        });
        zip[`${base}.cfg`] = new TextEncoder().encode(rewritten);
      }
      const zipped = zipSync(zip, { level: 6 });
      download(`${base}.zip`, new Blob([zipped as BlobPart], { type: 'application/zip' }));
      if (fail.length) {
        toast.warning('ZIP exported with missing images', { description: `Not found: ${fail.slice(0, 3).join(', ')}${fail.length > 3 ? '…' : ''}` });
      } else {
        toast.success('ZIP exported', { description: `${base}.cfg + artwork` });
      }
    } finally {
      setZipping(false);
    }
  };

  const importCfg = async (f: File) => {
    const text = await readFile(f, 'text');
    const ok = s.loadCfgText(text as string, f.name, 'replace');
    if (!ok) toast.error('Could not parse this file', { description: 'No overlay sections found.' });
    else toast.success(`Opened ${f.name}`, { description: `${useEditor.getState().model.overlays.length} overlay page(s)` });
  };

  const btn = 'h-9 gap-1.5 rounded-lg border-white/10 bg-white/[.04] text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white';
  const iconBtn = (on: boolean) =>
    `h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-white/10 transition ${on ? 'bg-teal-400/15 text-teal-300' : 'text-zinc-500 hover:bg-white/5'}`;
  const chip = (on: boolean) =>
    `rounded-lg px-2.5 py-2 text-xs font-semibold transition ring-1 ring-inset ${on ? 'bg-teal-400/15 text-teal-200 ring-teal-400/40' : 'bg-white/[.03] text-zinc-400 ring-white/10 hover:text-zinc-200'}`;
  const section = 'pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 first:pt-1';

  return (
    <header className="relative z-40 flex flex-wrap items-center gap-1 border-b border-white/5 bg-zinc-950/80 px-2 py-2 backdrop-blur sm:gap-1.5 sm:px-3">
      <div className="mr-1 flex items-center gap-2 sm:mr-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 shadow-lg shadow-teal-500/20">
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-zinc-950" fill="currentColor" aria-hidden>
            <path d="M8.4 5h7.2c2.6 0 4.9 1.9 5.3 4.5l.9 5.6a3 3 0 0 1-5.1 2.6l-1.6-1.6a2 2 0 0 0-1.4-.6h-3.4a2 2 0 0 0-1.4.6l-1.6 1.6a3 3 0 0 1-5.1-2.6l.9-5.6C3.5 6.9 5.8 5 8.4 5ZM7 9v1.5H5.5V12H7v1.5h1.5V12H10v-1.5H8.5V9H7Zm10 .5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 2.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
          </svg>
        </div>
        <div className="hidden leading-tight min-[420px]:block">
          <h1 className="text-sm font-extrabold tracking-tight text-white">Overlay Studio</h1>
          <p className="text-[10px] text-zinc-500">RetroArch overlay editor</p>
        </div>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

      <input ref={cfgInput} type="file" accept=".cfg,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importCfg(f); e.target.value = ''; }} />
      <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) importImages(e.target.files); e.target.value = ''; }} />

      {/* desktop: full toolbar */}
      <Button variant="outline" className={`${btn} hidden sm:inline-flex`} onClick={() => cfgInput.current?.click()}>
        <FolderOpen className="h-3.5 w-3.5" /> Open .cfg
      </Button>
      <Button variant="outline" className={`${btn} hidden sm:inline-flex`} onClick={() => imgInput.current?.click()}>
        <Images className="h-3.5 w-3.5" /> Images
        {s.lib.length > 0 && <span className="ml-0.5 rounded-full bg-teal-400/20 px-1.5 text-[10px] text-teal-300">{s.lib.length}</span>}
      </Button>
      <Button variant="outline" className={btn} onClick={() => s.setUI({ presetOpen: true })} title="Presets" aria-label="Presets">
        <Sparkles className="h-3.5 w-3.5 text-teal-300" /> <span className="hidden sm:inline">Presets</span>
      </Button>

      <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

      <Button variant="outline" className={btn} onClick={s.undo} disabled={!s.history.length} title="Undo (Ctrl+Z)">
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="outline" className={btn} onClick={s.redo} disabled={!s.future.length} title="Redo (Ctrl+Y)">
        <Redo2 className="h-3.5 w-3.5" />
      </Button>

      <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

      <select
        value={s.aspect}
        onChange={(e) => s.setUI({ aspect: +e.target.value })}
        className="hidden h-9 rounded-lg border border-white/10 bg-white/[.04] px-2 text-xs text-zinc-300 outline-none hover:bg-white/10 focus:border-teal-400/60 sm:block"
        title="Screen aspect ratio"
      >
        {ASPECTS.map((a, i) => (
          <option key={a.label} value={i}>{a.label}</option>
        ))}
      </select>

      <button
        onClick={() => s.setUI({ showGrid: !s.showGrid })}
        className={`hidden sm:flex ${iconBtn(s.showGrid)}`}
        title="Grid lines"
      >
        <Grid3x3 className="h-4 w-4" />
      </button>
      <button
        onClick={() => s.setUI({ snapOn: !s.snapOn })}
        className={`flex shrink-0 ${iconBtn(s.snapOn)}`}
        title="Snap to grid (move & resize) — hold Alt to bypass"
      >
        <Magnet className="h-4 w-4" />
      </button>

      {/* grid snap step picker */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex shrink-0 ${iconBtn(s.snapOn)} w-auto gap-1 px-2`}
            title="Grid snap step"
          >
            <Grid2x2 className="h-4 w-4" />
            <span className="hidden font-mono text-[11px] min-[420px]:inline">{stepLabel(s.gridStep)}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 border-white/10 bg-zinc-950/95 backdrop-blur-xl">
          <DropdownMenuRadioGroup value={String(s.gridStep)} onValueChange={(v) => s.setUI({ gridStep: +v })}>
            {STEPS.map((v) => (
              <DropdownMenuRadioItem key={v} value={String(v)} className="font-mono text-xs">
                {stepLabel(v)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-[10px] text-zinc-500">
            Hold Alt to bypass snap · Shift locks ratio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={() => s.setUI({ showHitbox: !s.showHitbox })}
        className={`hidden sm:flex ${iconBtn(s.showHitbox)}`}
        title="Show range_mod hitboxes"
      >
        <Scan className="h-4 w-4" />
      </button>

      {/* mobile: bottom sheet with flat, touch-friendly controls — no nested
          submenus (Radix submenus don't open reliably on Android touch) */}
      <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
        <SheetTrigger asChild>
          <button className={`flex sm:hidden ${iconBtn(false)}`} title="More tools">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="overlay-scroll max-h-[85dvh] overflow-y-auto rounded-t-2xl border-white/10 bg-zinc-950 px-4 pb-10"
        >
          <SheetHeader className="pb-1 text-left">
            <SheetTitle className="text-sm text-zinc-100">Tools & settings</SheetTitle>
            <SheetDescription className="text-xs text-zinc-500">Canvas, grid and file controls</SheetDescription>
          </SheetHeader>

          <p className={section}>Aspect ratio</p>
          <div className="grid grid-cols-3 gap-1.5">
            {ASPECTS.map((a, i) => (
              <button key={a.label} onClick={() => s.setUI({ aspect: i })} className={chip(s.aspect === i)}>
                {a.label}
              </button>
            ))}
          </div>

          <p className={section}>Grid</p>
          <div className="flex items-center justify-between rounded-lg bg-white/[.03] px-3 py-2.5 ring-1 ring-inset ring-white/5">
            <span className="flex items-center gap-2 text-xs font-medium text-zinc-300">
              <Grid3x3 className="h-3.5 w-3.5 text-zinc-500" /> Grid lines
            </span>
            <Switch checked={s.showGrid} onCheckedChange={(v) => s.setUI({ showGrid: v })} />
          </div>
          <div className="mt-1.5 flex items-center justify-between rounded-lg bg-white/[.03] px-3 py-2.5 ring-1 ring-inset ring-white/5">
            <span className="flex items-center gap-2 text-xs font-medium text-zinc-300">
              <Scan className="h-3.5 w-3.5 text-zinc-500" /> Range_mod hitboxes
            </span>
            <Switch checked={s.showHitbox} onCheckedChange={(v) => s.setUI({ showHitbox: v })} />
          </div>

          <p className={section}>Grid snap step</p>
          <div className="flex flex-wrap gap-1.5">
            {STEPS.map((v) => (
              <button key={v} onClick={() => s.setUI({ gridStep: v })} className={chip(s.gridStep === v)}>
                {stepLabel(v)}
              </button>
            ))}
          </div>
          <p className="pt-1.5 text-[10px] text-zinc-600">
            Snap is on for move &amp; resize — hold Alt to bypass, Shift locks ratio (desktop).
          </p>

          <p className={section}>Files</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" className={btn} onClick={() => act(() => cfgInput.current?.click())}>
              <FolderOpen className="h-3.5 w-3.5" /> Open .cfg
            </Button>
            <Button variant="outline" className={btn} onClick={() => act(() => imgInput.current?.click())}>
              <Images className="h-3.5 w-3.5" /> Images{s.lib.length > 0 ? ` (${s.lib.length})` : ''}
            </Button>
          </div>

          <p className={section}>Project</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" className={btn} onClick={() => act(() => s.setUI({ helpOpen: true }))}>
              <KeyboardIcon className="h-3.5 w-3.5" /> Shortcuts
            </Button>
            <Button variant="outline" className={btn} onClick={() => act(() => { s.newProject(true); toast('New project'); })}>
              <FilePlus2 className="h-3.5 w-3.5" /> New
            </Button>
            <Button variant="outline" className={btn} onClick={() => act(exportZip)} disabled={zipping}>
              {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />} ZIP
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 rounded-lg border-teal-400/30 bg-teal-400/10 text-xs font-medium text-teal-200 hover:bg-teal-400/20"
              onClick={() => act(() => s.setUI({ previewOpen: true }))}
            >
              <Play className="h-3.5 w-3.5" /> Preview
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" className={`${btn} hidden sm:inline-flex`} onClick={() => s.setUI({ helpOpen: true })} title="Keyboard shortcuts">
          <KeyboardIcon className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" className={`${btn} hidden sm:inline-flex`} onClick={() => { s.newProject(true); toast('New project'); }} title="New project">
          <FilePlus2 className="h-3.5 w-3.5" /> New
        </Button>
        <Button variant="outline" className={`${btn} hidden sm:inline-flex`} onClick={exportZip} disabled={zipping} title="Export .cfg + artwork as ZIP">
          {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />} ZIP
        </Button>
        <Button className="h-9 gap-1.5 rounded-lg bg-teal-400 text-xs font-bold text-zinc-950 shadow-lg shadow-teal-500/20 hover:bg-teal-300" onClick={saveCfg}>
          <Save className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Save .cfg</span>
        </Button>
        <Button
          variant="outline"
          className="hidden h-9 gap-1.5 rounded-lg border-teal-400/30 bg-teal-400/10 text-xs font-medium text-teal-200 hover:bg-teal-400/20 sm:inline-flex"
          onClick={() => s.setUI({ previewOpen: true })}
        >
          <Play className="h-3.5 w-3.5" /> Preview
        </Button>
      </div>
    </header>
  );
}
