'use client';

import React from 'react';
import { useEditor } from '@/lib/store';
import { ovName } from '@/lib/cfg';
import { cn } from '@/lib/utils';
import { Plus, Copy, X } from 'lucide-react';

export default function PageTabs() {
  const s = useEditor();
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto border-b border-white/5 bg-zinc-950/60 px-2 py-1.5 overlay-scroll">
      {s.model.overlays.map((o, i) => {
        const active = i === s.cur;
        const name = ovName(o);
        return (
          <button
            key={i}
            onClick={() => s.setCur(i)}
            className={cn(
              'group flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              active
                ? 'bg-teal-400/15 text-teal-200 ring-1 ring-inset ring-teal-400/40'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
            )}
          >
            <span className="font-mono text-[9px] text-zinc-600">{i}</span>
            <span className="max-w-36 truncate">{name}</span>
            <span className="font-mono text-[9px] text-zinc-600">{o.descs.length}</span>
          </button>
        );
      })}
      <div className="ml-1 flex shrink-0 items-center gap-1">
        <button
          onClick={s.addOverlay}
          title="Add page"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-teal-300"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={s.duplicateOverlay}
          title="Duplicate current page"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <Copy className="h-3 w-3" />
        </button>
        {s.model.overlays.length > 1 && (
          <button
            onClick={s.deleteOverlay}
            title="Delete current page"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
