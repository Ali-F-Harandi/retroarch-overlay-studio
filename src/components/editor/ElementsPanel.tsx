'use client';

import React from 'react';
import { useEditor } from '@/lib/store';
import { inputKind, COLOR, isCombo } from '@/lib/cfg';
import { cn } from '@/lib/utils';
import {
  Plus, Copy, Trash2, GripVertical, Layers, Gamepad2, SlidersHorizontal,
  CircleSlash, Expand, Aperture,
} from 'lucide-react';

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  game: Gamepad2,
  system: SlidersHorizontal,
  menu: Layers,
  analog: Expand,
  area: Aperture,
  none: CircleSlash,
};

export function AddButton() {
  const s = useEditor();
  return (
    <div className="flex items-center gap-2 px-3 pb-2 pt-1">
      <button
        onClick={() => s.addDesc('a')}
        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-400/15 px-3 text-xs font-semibold text-teal-300 ring-1 ring-inset ring-teal-400/30 transition hover:bg-teal-400/25"
      >
        <Plus className="h-3.5 w-3.5" /> Add element
      </button>
      <button
        onClick={s.duplicateSel}
        disabled={!s.sel.length}
        title="Duplicate selection (Ctrl+D)"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-40"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={s.deleteSel}
        disabled={!s.sel.length}
        title="Delete selection (Del)"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-400/80 ring-1 ring-inset ring-white/10 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function ElementsPanel() {
  const s = useEditor();
  const o = s.model.overlays[s.cur];
  if (!o) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Elements</h3>
        <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-500">{o.descs.length}</span>
      </div>
      <div className="overlay-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {o.descs.length === 0 && (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-zinc-600">
            Nothing here yet.<br />Use “Add element” or load a preset.
          </p>
        )}
        <ul className="space-y-0.5">
          {o.descs.map((d, i) => {
            const kind = inputKind(d.name);
            const color = COLOR[kind];
            const Icon = KIND_ICON[kind] ?? Gamepad2;
            const active = s.sel.includes(d.id);
            return (
              <li key={d.id}>
                <button
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = parseInt(e.dataTransfer.getData('text/plain'));
                    if (Number.isFinite(from) && from !== i) s.reorder(from, i);
                  }}
                  onClick={(e) => {
                    if (e.shiftKey) s.toggleSelect(d.id);
                    else s.select([d.id]);
                  }}
                  className={cn(
                    'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition',
                    active ? 'bg-teal-400/15 ring-1 ring-inset ring-teal-400/40' : 'hover:bg-white/5',
                  )}
                >
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-700 group-hover:text-zinc-500" />
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                  <span className={cn('min-w-0 flex-1 truncate font-mono text-xs', active ? 'text-teal-200' : 'text-zinc-300', isCombo(d.name) && 'italic')}>
                    {d.name}
                  </span>
                  {d.image && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" title={d.image} />}
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-600">
                    {(d.x * 100).toFixed(0)},{(d.y * 100).toFixed(0)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <AddButton />
    </div>
  );
}
