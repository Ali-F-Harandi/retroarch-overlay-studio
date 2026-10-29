'use client';

import React, { useEffect, useRef } from 'react';
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
import { History, X } from 'lucide-react';

function RestoreBanner() {
  const s = useEditor();
  const [pending, setPending] = React.useState<{ cfg: string; fileName: string; savedAt: number } | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    queueMicrotask(() => {
      const ses = loadSession();
      if (ses) setPending({ cfg: ses.cfg, fileName: ses.fileName, savedAt: ses.savedAt });
    });
  }, []);

  if (!pending) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-teal-400/30 bg-zinc-900/95 px-4 py-2.5 shadow-2xl shadow-black/60 backdrop-blur">
      <History className="h-4 w-4 shrink-0 text-teal-300" />
      <p className="text-xs text-zinc-300">
        Restore unsaved session <span className="font-semibold text-zinc-100">“{pending.fileName}”</span>?
      </p>
      <Button
        size="sm"
        className="h-7 rounded-lg bg-teal-400 px-3 text-[11px] font-bold text-zinc-950 hover:bg-teal-300"
        onClick={() => {
          s.loadCfgText(pending.cfg, pending.fileName, 'replace');
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

      {/* mobile panels */}
      <div className="flex gap-2 overflow-x-auto border-t border-white/5 bg-zinc-950/80 p-2 lg:hidden">
        <details className="min-w-40 flex-1 rounded-lg border border-white/5 bg-white/[.02] px-3 py-2 md:hidden">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-300">Elements</summary>
          <div className="max-h-64 overflow-y-auto overlay-scroll">
            <ElementsPanel />
          </div>
        </details>
        <details className="min-w-40 flex-1 rounded-lg border border-white/5 bg-white/[.02] px-3 py-2 lg:hidden">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-300">Properties</summary>
          <div className="max-h-64 overflow-y-auto overlay-scroll">
            <PropertiesPanel />
          </div>
        </details>
      </div>

      <PresetBrowser />
      <PreviewOverlay />
      <HelpDialog />
      <RestoreBanner />
    </main>
  );
}
