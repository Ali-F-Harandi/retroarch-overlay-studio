'use client';

import React, { useEffect } from 'react';
import { useEditor } from '@/lib/store';
import { serializeCfg } from '@/lib/cfg';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function HelpDialog() {
  const s = useEditor();
  const cfgText = serializeCfg(s.model);

  useEffect(() => {
    if (!s.helpOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') s.setUI({ helpOpen: false }); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [s.helpOpen, s]);

  return (
    <Dialog open={s.helpOpen} onOpenChange={(v) => s.setUI({ helpOpen: v })}>
      <DialogContent className="max-h-[85dvh] max-w-3xl overflow-hidden sm:max-w-3xl border-white/10 bg-zinc-950/95 p-0">
        <div className="overlay-scroll max-h-[85dvh] overflow-y-auto">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-base font-bold text-zinc-100">Shortcuts & reference</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Everything you need to move fast.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 px-6 pb-6 pt-2 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Canvas</h3>
              <ul className="space-y-1.5 text-xs text-zinc-400">
                {[
                  ['Drag element', 'move'],
                  ['Corner handles', 'resize (single) / scale group'],
                  ['Shift + click', 'add to selection'],
                  ['Drag empty area', 'marquee select'],
                  ['Arrow keys', 'nudge (Shift = ×8)'],
                  ['Delete / Backspace', 'remove selection'],
                  ['Ctrl + D', 'duplicate'],
                  ['Ctrl + Z / Ctrl + Y', 'undo / redo'],
                  ['Esc', 'clear selection'],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-3 rounded-md bg-white/[.03] px-2.5 py-1.5">
                    <kbd className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-teal-300 ring-1 ring-inset ring-white/10">{k}</kbd>
                    <span className="text-right text-[11px] text-zinc-500">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">How range_mod works</h3>
              <p className="text-xs leading-relaxed text-zinc-400">
                The graphic always renders at the desc <code className="rounded bg-black/50 px-1 font-mono text-[10px] text-amber-300">w × h</code> size.
                <code className="mx-1 rounded bg-black/50 px-1 font-mono text-[10px] text-amber-300">range_mod</code>
                only scales the <em>touch area</em> while the button is being pressed. Toggle the
                <strong className="text-teal-300"> hitbox view</strong> (Scan icon) to see the enlarged touch zones as dashed outlines.
                A per-element range_mod overrides the page-level value.
              </p>
              <h3 className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Exporting</h3>
              <p className="text-xs leading-relaxed text-zinc-400">
                <strong className="text-zinc-200">Save .cfg</strong> writes a normalized RetroArch config preserving every
                unknown key from the original file. <strong className="text-zinc-200">ZIP</strong> bundles the .cfg with all
                referenced artwork flattened into <code className="rounded bg-black/50 px-1 font-mono text-[10px] text-amber-300">img/</code>.
                Preset images from the bundled library are fetched automatically during export.
              </p>
              <h3 className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Live .cfg preview</h3>
              <pre className="overlay-scroll max-h-40 overflow-auto rounded-lg border border-white/5 bg-black/60 p-3 font-mono text-[10px] leading-relaxed text-zinc-400">
                {cfgText.split('\n').slice(0, 60).join('\n')}
                {cfgText.split('\n').length > 60 ? '\n…' : ''}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
