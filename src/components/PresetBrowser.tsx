'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useEditor } from '@/lib/store';
import { fetchPresetIndex, fetchPresetCfg, presetsFileUrl, PresetIndex, PresetCfg } from '@/lib/presets';
import { resolveImgRef, ovImage, isPixelSpace } from '@/lib/cfg';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, Loader2, Gamepad2, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const CAT_ICON: Record<string, string> = {
  gamepads: '🎮', keyboards: '⌨️', borders: '🖼️', effects: '✨', misc: '🧩', ipad: '📱', wii: '🎯', ctr: '🎮', keyboard: '⌨️',
};

export default function PresetBrowser() {
  const s = useEditor();
  const [index, setIndex] = useState<PresetIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<string>('gamepads');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');

  useEffect(() => {
    if (!s.presetOpen || index) return;
    fetchPresetIndex()
      .then(setIndex)
      .catch((e) => setError(String(e.message ?? e)));
  }, [s.presetOpen, index]);

  const cat0 = useMemo(() => index?.categories.find((c) => c.id === cat) ?? null, [index, cat]);
  const searching = q.trim().length >= 2;
  const results = useMemo(() => {
    if (!index) return [];
    const term = q.trim().toLowerCase();
    if (searching) {
      const all = index.categories.flatMap((c) => c.cfgs);
      return all.filter((c) => c.name.toLowerCase().includes(term) || c.path.toLowerCase().includes(term) || c.names.some((n) => n.toLowerCase().includes(term)));
    }
    return cat0?.cfgs ?? [];
  }, [cat0, q, index, searching]);

  const load = async (p: PresetCfg) => {
    setLoading(p.path);
    try {
      const text = await fetchPresetCfg(p.path);
      const ok = s.loadCfgText(text, p.file, mode);
      if (!ok) {
        toast.error('This preset has no overlays to edit');
        return;
      }
      const st = useEditor.getState();
      const dir = p.dir;
      const imgs = new Map<string, { rel: string; abs: string }>(); // lower(rel) -> original ref + resolved path
      for (const o of st.model.overlays) {
        const bg = ovImage(o);
        if (bg && !imgs.has(bg.toLowerCase())) {
          imgs.set(bg.toLowerCase(), { rel: bg, abs: resolveImgRef(dir, bg) });
        }
        for (const d of o.descs) {
          if (d.image && !imgs.has(d.image.toLowerCase())) {
            imgs.set(d.image.toLowerCase(), { rel: d.image, abs: resolveImgRef(dir, d.image) });
          }
        }
      }

      // normalize pixel-space overlays using the page background image size when available
      const sizes: ({ w: number; h: number } | null)[] = [];
      for (const o of st.model.overlays) {
        if (!isPixelSpace(o)) { sizes.push(null); continue; }
        const bg = ovImage(o);
        const abs = bg ? resolveImgRef(dir, bg) : '';
        if (!abs) { sizes.push(null); continue; }
        try {
          const dim = await new Promise<{ w: number; h: number }>((res, rej) => {
            const im = new Image();
            im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
            im.onerror = rej;
            im.src = presetsFileUrl(abs);
          });
          sizes.push(dim);
        } catch {
          sizes.push(null);
        }
      }
      s.normalizePixelOverlays(sizes);

      // register builtin images (refs as written in cfg -> site URL)
      if (imgs.size) {
        s.addLibImages(
          [...imgs.values()].map(({ rel, abs }) => ({
            rel,
            name: rel.split('/').pop() ?? rel,
            url: presetsFileUrl(abs),
            builtin: true,
          })),
        );
      }
      toast.success(`Loaded “${p.name}”`, {
        description: mode === 'append' ? 'Appended as new page(s).' : 'Replaced the workspace.',
      });
      s.setUI({ presetOpen: false });
    } catch (e) {
      toast.error('Failed to load preset', { description: String((e as Error).message ?? e) });
    } finally {
      setLoading(null);
    }
  };

  const thumbUrl = (p: PresetCfg): string | null => {
    if (!p.thumb) return null;
    // index.json already stores the thumb path relative to /presets — do not re-resolve
    return presetsFileUrl(p.thumb.replace(/"/g, ''));
  };

  return (
    <Dialog open={s.presetOpen} onOpenChange={(v) => s.setUI({ presetOpen: v })}>
      {/* sm:max-w-* overrides the dialog default so the panel can actually use its width */}
      <DialogContent className="flex h-[92dvh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-white/10 bg-zinc-950/95 p-0 backdrop-blur-xl sm:h-[88dvh] sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-white/5 px-4 py-3 sm:px-5 sm:py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100 sm:text-base">
            <Sparkles className="h-4 w-4 shrink-0 text-teal-300" /> Official presets
            <span className="rounded-full bg-teal-400/10 px-2 py-0.5 text-[10px] font-medium text-teal-300 ring-1 ring-inset ring-teal-400/30">
              libretro buildbot · CC-BY-4.0
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            312 official overlay configs with all artwork, bundled offline in this app.
          </DialogDescription>
        </DialogHeader>

        {/* search + load mode — stacks on narrow screens */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-white/5 px-4 py-2.5 sm:flex-row sm:items-center sm:px-5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search all presets… (e.g. snes, gba, atari)"
              className="h-9 border-white/10 bg-black/30 pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="hidden text-[10px] font-medium uppercase tracking-wider text-zinc-600 sm:inline">Load mode</span>
            <div className="flex overflow-hidden rounded-lg ring-1 ring-inset ring-white/10">
              {(['replace', 'append'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn('px-3 py-2 text-[11px] font-medium capitalize transition', mode === m ? 'bg-teal-400/20 text-teal-200' : 'text-zinc-500 hover:bg-white/5')}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* categories — sidebar on desktop, scrollable chips on mobile */}
          <aside className="overlay-scroll hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-white/5 p-2 lg:flex">
            {index?.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCat(c.id); setQ(''); }}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition',
                  cat === c.id && !searching ? 'bg-teal-400/15 text-teal-200 ring-1 ring-inset ring-teal-400/30' : 'text-zinc-400 hover:bg-white/5',
                )}
              >
                <span aria-hidden>{CAT_ICON[c.id] ?? '📁'}</span>
                <span className="flex-1 capitalize">{c.id}</span>
                <span className="font-mono text-[10px] text-zinc-600">{c.count}</span>
              </button>
            ))}
          </aside>
          <div className="overlay-scroll flex shrink-0 gap-1.5 overflow-x-auto px-3 py-2 lg:hidden">
            {index?.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCat(c.id); setQ(''); }}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition',
                  cat === c.id && !searching
                    ? 'bg-teal-400/20 text-teal-200 ring-1 ring-inset ring-teal-400/40'
                    : 'bg-white/5 text-zinc-400 ring-1 ring-inset ring-white/10 hover:bg-white/10',
                )}
              >
                <span aria-hidden>{CAT_ICON[c.id] ?? '📁'}</span>
                {c.id}
                <span className="font-mono text-[9px] text-zinc-600">{c.count}</span>
              </button>
            ))}
          </div>

          {/* grid */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="overlay-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {error && (
                <p className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300 ring-1 ring-inset ring-rose-500/30">{error}</p>
              )}
              {!index && !error && (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
                </div>
              )}
              {index && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                  {results.map((p) => {
                    const src = thumbUrl(p);
                    return (
                      <button
                        key={p.path}
                        onClick={() => load(p)}
                        disabled={!!loading}
                        title={p.path}
                        className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-white/[.03] text-left transition hover:border-teal-400/40 hover:bg-teal-400/5"
                      >
                        <div
                          className="flex aspect-[4/3] items-center justify-center overflow-hidden p-2"
                          style={{ background: 'repeating-conic-gradient(#1b1b1f 0% 25%, #141417 0% 50%) 50% / 20px 20px' }}
                        >
                          {src ? (
                            <img
                              src={src}
                              alt={p.name}
                              loading="lazy"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              className="max-h-full max-w-full object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <Gamepad2 className="h-8 w-8 text-zinc-700" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 border-t border-white/5 px-2.5 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-zinc-200">{p.name}</p>
                            <p className="truncate font-mono text-[10px] text-zinc-600">
                              {p.overlays} page{p.overlays === 1 ? '' : 's'} · {p.descs} elem
                            </p>
                          </div>
                          {loading === p.path ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-300" />
                          ) : (
                            <Download className="h-4 w-4 shrink-0 text-zinc-700 transition group-hover:text-teal-300" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {results.length === 0 && (
                    <p className="col-span-full py-12 text-center text-xs text-zinc-600">
                      No presets match {searching ? `“${q.trim()}”` : 'this category'}.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
