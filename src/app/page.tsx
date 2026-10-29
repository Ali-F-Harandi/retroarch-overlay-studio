'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '@/lib/store';
import { loadSession } from '@/lib/persist';
import TopBar from '@/components/TopBar';
import PageTabs from '@/components/editor/PageTabs';
import Canvas from '@/components/editor/Canvas';
import ElementsPanel from '@/components/editor/ElementsPanel';
import PropertiesPanel from '@/components/editor/PropertiesPanel';
import PresetBrowser from '@/components/PresetBrowser';
import PreviewOverlay from '@/components/PreviewOverlay';
import HelpDialog from '@/components/HelpDialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { History, Layers, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function RestoreBanner() {
  const s = useEditor();
  const [pending, setPending] = React.useState<{
    cfg: string; fileName: string; savedAt: number;
    ui?: { aspect?: number; gridStep?: number; showGrid?: boolean; snapOn?: boolean; showHitbox?: boolean };
  } | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    queueMicrotask(() => {
      const ses = loadSession();
      if (ses) setPending({ cfg: ses.cfg, fileName: ses.fileName, savedAt: ses.savedAt, ui: ses.ui });
    });
  }, []);

  if (!pending) return null;

  return (
    <div className="fixed bottom-[4.75rem] left-1/2 z-50 flex w-max max-w-[94vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-teal-400/30 bg-zinc-900/95 px-4 py-2.5 shadow-2xl shadow-black/60 backdrop-blur sm:bottom-4">
      <History className="h-4 w-4 shrink-0 text-teal-300" />
      <p className="text-xs text-zinc-300">
        Restore unsaved session <span className="font-semibold text-zinc-100">“{pending.fileName}”</span>?
      </p>
      <Button
        size="sm"
        className="h-7 rounded-lg bg-teal-400 px-3 text-[11px] font-bold text-zinc-950 hover:bg-teal-300"
        onClick={() => {
          s.loadCfgText(pending.cfg, pending.fileName, 'replace');
          // also bring back the saved editor preferences (grid, snap, aspect…)
          if (pending.ui) {
            const ui: Parameters<typeof s.setUI>[0] = {};
            const u = pending.ui;
            if (u.aspect !== undefined) ui.aspect = u.aspect;
            if (u.gridStep !== undefined) ui.gridStep = u.gridStep;
            if (u.showGrid !== undefined) ui.showGrid = u.showGrid;
            if (u.snapOn !== undefined) ui.snapOn = u.snapOn;
            if (u.showHitbox !== undefined) ui.showHitbox = u.showHitbox;
            if (Object.keys(ui).length) s.setUI(ui);
          }
          setPending(null);
          toast.success('Session restored');
        }}
      >
        Restore
      </Button>
      <button
        onClick={() => setPending(null)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function Home() {
  const s = useEditor();
  // which bottom sheet is open on small screens (exclusive — only one at a time)
  const [panel, setPanel] = useState<'none' | 'elements' | 'props'>('none');

  useEffect(() => s.setLoaded(true), []);

  // global undo/redo
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [s]);

  // beforeunload guard when dirty
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (s.history.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [s.history.length]);

  return (
    <main className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-200">
      <TopBar />
      <PageTabs />
      <div className="flex min-h-0 flex-1">
        {/* left */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-zinc-950/60 md:flex">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Pages</h3>
            <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-500">{s.model.overlays.length}</span>
          </div>
          <ElementsPanel />
        </aside>

        {/* center */}
        <section className="relative min-w-0 flex-1 bg-[#0b0b0e]">
          <Canvas />
        </section>

        {/* right */}
        <aside className="hidden w-72 shrink-0 flex-col border-l border-white/5 bg-zinc-950/60 lg:flex">
          <div className="border-b border-white/5 px-3 py-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              {s.sel.length > 1 ? 'Multi-selection' : s.sel.length === 1 ? 'Element' : 'Page settings'}
            </h3>
          </div>
          <PropertiesPanel />
        </aside>
      </div>

      {/* mobile panel bar + bottom sheets — exclusive, so the board above
          always stays fully visible (the canvas resizes via container queries) */}
      <div className="flex gap-2 border-t border-white/5 bg-zinc-950/90 p-2 lg:hidden">
        <button
          onClick={() => setPanel((p) => (p === 'elements' ? 'none' : 'elements'))}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition md:hidden',
            panel === 'elements'
              ? 'bg-teal-400/15 text-teal-200 ring-1 ring-inset ring-teal-400/40'
              : 'bg-white/[.03] text-zinc-400 ring-1 ring-inset ring-white/10 hover:text-zinc-200',
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          Elements
          <span className="rounded-full bg-white/5 px-1.5 font-mono text-[10px] text-zinc-500">
            {s.model.overlays[s.cur]?.descs.length ?? 0}
          </span>
        </button>
        <button
          onClick={() => setPanel((p) => (p === 'props' ? 'none' : 'props'))}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition',
            panel === 'props'
              ? 'bg-teal-400/15 text-teal-200 ring-1 ring-inset ring-teal-400/40'
              : 'bg-white/[.03] text-zinc-400 ring-1 ring-inset ring-white/10 hover:text-zinc-200',
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Properties
          {s.sel.length > 0 && (
            <span className="rounded-full bg-teal-400/20 px-1.5 font-mono text-[10px] text-teal-300">{s.sel.length}</span>
          )}
        </button>
      </div>

      {panel !== 'none' && (
        <div className="border-t border-white/5 bg-zinc-950/95 lg:hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              {panel === 'elements' ? 'Elements' : s.sel.length > 1 ? 'Multi-selection' : s.sel.length === 1 ? 'Element' : 'Page settings'}
            </h3>
            <button
              onClick={() => setPanel('none')}
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              title="Close panel"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className="overlay-scroll max-h-[42dvh] overflow-y-auto pb-2">
            {panel === 'elements' ? <ElementsPanel showHeader={false} /> : <PropertiesPanel />}
          </div>
        </div>
      )}

      <PresetBrowser />
      <PreviewOverlay />
      <HelpDialog />
      {/* hide the restore prompt while a mobile sheet is open — it would cover it */}
      {panel === 'none' && <RestoreBanner />}
    </main>
  );
}
