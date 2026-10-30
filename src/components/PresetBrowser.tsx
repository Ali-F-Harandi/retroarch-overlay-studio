'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useEditor } from '@/lib/store';
import { fetchPresetIndex, fetchPresetCfg, presetsFileUrl, PresetIndex, PresetCfg } from '@/lib/presets';
import { resolveImgRef, ovImage, isPixelSpace } from '@/lib/cfg';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, Loader2, FolderOpen, Download, Sparkles, ChevronRight, Home, ImageOff } from 'lucide-react';
import { toast } from 'sonner';

/* ---------- folder tree built from cfg paths ---------- */

interface FolderNode {
  name: string;
  cfgs: PresetCfg[];
  children: Map<string, FolderNode>;
}

const newNode = (name: string): FolderNode => ({ name, cfgs: [], children: new Map() });

function buildTree(index: PresetIndex): FolderNode {
  const root = newNode('');
  for (const cat of index.categories) {
    for (const cfg of cat.cfgs) {
      const parts = cfg.path.split('/');
      parts.pop(); // drop file name
      let node = root;
      for (const p of parts) {
        let child = node.children.get(p);
        if (!child) { child = newNode(p); node.children.set(p, child); }
        node = child;
      }
      node.cfgs.push(cfg);
    }
  }
  return root;
}

function countCfgs(n: FolderNode): number {
  let c = n.cfgs.length;
  for (const ch of n.children.values()) c += countCfgs(ch);
  return c;
}

/** first few cfg thumbs found under this folder (breadth-first, for the collage) */
function sampleThumbs(n: FolderNode, max = 3): string[] {
  const out: string[] = [];
  const walk = (node: FolderNode) => {
    for (const cfg of node.cfgs) {
      if (cfg.thumb) out.push(cfg.thumb);
      if (out.length >= max) return;
    }
    if (out.length < max) for (const ch of node.children.values()) walk(ch);
  };
  walk(n);
  return out;
}

const CAT_ICON: Record<string, string> = {
  custom: '⭐', gamepads: '🎮', keyboards: '⌨️', borders: '🖼️', effects: '✨', misc: '🧩', ipad: '📱', wii: '🎯', ctr: '🎮',
};
const folderIcon = (name: string) => CAT_ICON[name.toLowerCase()] ?? '📁';

/* ---------- preset card ---------- */

function CfgCard({ p, loading, onLoad }: { p: PresetCfg; loading: string | null; onLoad: (p: PresetCfg) => void }) {
  const src = p.thumb ? presetsFileUrl(p.thumb.replace(/"/g, '')) : null;
  return (
    <button
      onClick={() => onLoad(p)}
      disabled={!!loading}
      title={p.path}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-white/[.03] text-left transition hover:border-teal-400/40 hover:bg-teal-400/5"
    >
      <div
        className="flex aspect-[4/3] items-center justify-center overflow-hidden p-2"
        style={{ background: 'repeating-conic-gradient(#1b1b1f 0% 25%, #141417 0% 50%) 50% / 20px 20px' }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={p.name}
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            className="max-h-full max-w-full object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <ImageOff className="h-6 w-6 text-zinc-700" />
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
}

/* ---------- folder card with real-thumb collage ---------- */

function FolderCard({ node, path, onOpen }: { node: FolderNode; path: string[]; onOpen: (p: string[]) => void }) {
  const n = countCfgs(node);
  const thumbs = sampleThumbs(node);
  const isRoot = path.length === 1;
  return (
    <button
      onClick={() => onOpen(path)}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-white/5 bg-white/[.03] text-left transition hover:border-teal-400/40 hover:bg-teal-400/5',
        isRoot && 'min-h-[132px]',
      )}
    >
      <div
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
        style={{ background: 'repeating-conic-gradient(#1b1b1f 0% 25%, #141417 0% 50%) 50% / 20px 20px' }}
      >
        {thumbs.length > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={presetsFileUrl(thumbs[0])} alt="" loading="lazy" className="h-full w-full object-contain p-1.5 drop-shadow-lg" />
            {thumbs[1] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={presetsFileUrl(thumbs[1])} alt="" loading="lazy" className="absolute bottom-1 right-1 h-[38%] rounded border border-white/10 object-contain p-0.5 shadow-lg" />
            )}
            {thumbs[2] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={presetsFileUrl(thumbs[2])} alt="" loading="lazy" className="absolute left-1 top-1 h-[30%] rounded border border-white/10 object-contain p-0.5 shadow-lg" />
            )}
          </>
        ) : (
          <FolderOpen className="h-8 w-8 text-zinc-700" />
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-white/5 px-2.5 py-2">
        <span aria-hidden className="text-sm">{folderIcon(node.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-zinc-200 capitalize">{node.name.replace(/[-_]/g, ' ')}</p>
          <p className="font-mono text-[10px] text-zinc-600">{n} preset{n === 1 ? '' : 's'}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-teal-300" />
      </div>
    </button>
  );
}

/* ---------- main ---------- */

export default function PresetBrowser() {
  const s = useEditor();
  const [index, setIndex] = useState<PresetIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');

  useEffect(() => {
    if (!s.presetOpen || index) return;
    fetchPresetIndex()
      .then(setIndex)
      .catch((e) => setError(String(e.message ?? e)));
  }, [s.presetOpen, index]);

  const tree = useMemo(() => (index ? buildTree(index) : null), [index]);

  // reset navigation when the dialog reopens
  useEffect(() => {
    if (s.presetOpen) { setCrumbs([]); setQ(''); }
  }, [s.presetOpen]);

  const searching = q.trim().length >= 2;
  const results = useMemo(() => {
    if (!index || !searching) return [];
    const term = q.trim().toLowerCase();
    return index.categories
      .flatMap((c) => c.cfgs)
      .filter((c) => c.name.toLowerCase().includes(term) || c.path.toLowerCase().includes(term) || c.names.some((n) => n.toLowerCase().includes(term)));
  }, [index, q, searching]);

  const current = useMemo(() => {
    if (!tree) return null;
    let node = tree;
    for (const c of crumbs) {
      const next = node.children.get(c);
      if (!next) return null;
      node = next;
    }
    return node;
  }, [tree, crumbs]);

  const folders = useMemo(() => {
    if (!current) return [];
    return [...current.children.values()].sort((a, b) => {
      // the Custom folder (user's own presets) always comes first
      const pa = a.name.toLowerCase() === 'custom' ? 0 : 1;
      const pb = b.name.toLowerCase() === 'custom' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });
  }, [current]);

  const cfgs = useMemo(() => {
    if (!current) return [];
    return [...current.cfgs].sort((a, b) => a.name.localeCompare(b.name));
  }, [current]);

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
      const imgs = new Map<string, { rel: string; abs: string }>();
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

  return (
    <Dialog open={s.presetOpen} onOpenChange={(v) => s.setUI({ presetOpen: v })}>
      <DialogContent className="flex h-[92dvh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-white/10 bg-zinc-950/95 p-0 backdrop-blur-xl sm:h-[88dvh] sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-white/5 px-4 py-3 sm:px-5 sm:py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100 sm:text-base">
            <Sparkles className="h-4 w-4 shrink-0 text-teal-300" /> Preset library
            <span className="rounded-full bg-teal-400/10 px-2 py-0.5 text-[10px] font-medium text-teal-300 ring-1 ring-inset ring-teal-400/30">
              libretro buildbot · CC-BY-4.0
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Browse the folders to find a preset — {index ? `${index.categories.reduce((n, c) => n + c.count, 0)} configs` : 'hundreds of configs'} bundled offline.
            The ⭐ Custom folder holds the hand-made console overlays (GB, GBA, NES, Genesis, SNES).
          </DialogDescription>
        </DialogHeader>

        {/* search + load mode */}
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

        {/* breadcrumb */}
        <div className="overlay-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/5 px-4 py-2 text-xs sm:px-5">
          <button
            onClick={() => setCrumbs([])}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium transition',
              crumbs.length === 0 ? 'bg-teal-400/15 text-teal-200' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
            )}
          >
            <Home className="h-3.5 w-3.5" /> Library
          </button>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-700" />
              <button
                onClick={() => setCrumbs(crumbs.slice(0, i + 1))}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium transition',
                  i === crumbs.length - 1 ? 'bg-teal-400/15 text-teal-200' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
                )}
              >
                <span aria-hidden>{folderIcon(c)}</span>
                <span className="capitalize">{c.replace(/[-_]/g, ' ')}</span>
              </button>
            </React.Fragment>
          ))}
          <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-zinc-600 sm:inline">
            {searching ? `${results.length} result${results.length === 1 ? '' : 's'}` : current ? countCfgs(current) : 0} presets
          </span>
        </div>

        {/* content */}
        <div className="overlay-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {error && (
            <p className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300 ring-1 ring-inset ring-rose-500/30">{error}</p>
          )}
          {!index && !error && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
            </div>
          )}

          {index && searching && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
              {results.map((p) => <CfgCard key={p.path} p={p} loading={loading} onLoad={load} />)}
              {results.length === 0 && (
                <p className="col-span-full py-12 text-center text-xs text-zinc-600">No presets match “{q.trim()}”.</p>
              )}
            </div>
          )}

          {index && !searching && current && (
            <>
              {folders.length > 0 && (
                <>
                  <p className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    Folders ({folders.length})
                  </p>
                  <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
                    {folders.map((f) => (
                      <FolderCard key={f.name} node={f} path={[...crumbs, f.name]} onOpen={setCrumbs} />
                    ))}
                  </div>
                </>
              )}
              {cfgs.length > 0 && (
                <>
                  <p className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    Presets ({cfgs.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                    {cfgs.map((p) => <CfgCard key={p.path} p={p} loading={loading} onLoad={load} />)}
                  </div>
                </>
              )}
              {folders.length === 0 && cfgs.length === 0 && (
                <p className="py-12 text-center text-xs text-zinc-600">This folder is empty.</p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
