'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, imageForDesc, ASPECTS } from '@/lib/store';
import { effectiveRangeMod, inputKind, hitTest, ovImage } from '@/lib/cfg';
import { cn } from '@/lib/utils';
import { X, SunMedium, Grid3x3, Scan } from 'lucide-react';

export default function PreviewOverlay() {
  const s = useEditor();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const touches = useRef(new Map<number, [number, number]>());
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [showGuides, setShowGuides] = useState(false);

  const o = s.model.overlays[s.cur];
  const aspect = ASPECTS[s.aspect] ?? ASPECTS[0];

  const recompute = useCallback(() => {
    if (!o) return;
    const el = surfaceRef.current;
    if (!el) return;
    const hit = new Set<string>();
    touches.current.forEach(([x, y]) => {
      for (const d of o.descs) {
        if (hitTest(o, d, x, y)) hit.add(d.id);
      }
    });
    setPressed(hit);
  }, [o]);

  useEffect(() => {
    if (!s.previewOpen) {
      queueMicrotask(() => {
        touches.current.clear();
        setPressed(new Set());
      });
    }
  }, [s.previewOpen]);

  useEffect(() => {
    if (!s.previewOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') s.setUI({ previewOpen: false });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [s.previewOpen, s]);

  if (!s.previewOpen || !o) return null;

  const toNorm = (e: React.PointerEvent): [number, number] => {
    const r = surfaceRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    touches.current.set(e.pointerId, toNorm(e));
    recompute();
  };
  const move = (e: React.PointerEvent) => {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, toNorm(e));
    recompute();
  };
  const up = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId);
    recompute();
  };

  const pressedNames = [...pressed].map((id) => o.descs.find((d) => d.id === id)?.name).filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="pointer-events-auto flex items-center justify-between gap-3 border-b border-white/10 bg-zinc-950/80 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-400">
          <Scan className="h-3.5 w-3.5 shrink-0 text-teal-300" />
          <span className="truncate font-semibold text-zinc-200">{o.props.find(([k]) => k === 'name')?.[1]?.replace(/^"|"$/g, '') || 'Preview'}</span>
          <span className="hidden text-zinc-600 sm:inline">· touch / drag to test hitboxes · multi-touch supported</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-2 text-[11px] text-zinc-500 sm:flex">
            <SunMedium className="h-3.5 w-3.5" />
            <input
              type="range" min={20} max={100} value={Math.round(s.previewOpacity * 100)}
              onChange={(e) => s.setUI({ previewOpacity: +e.target.value / 100 })}
              className="h-1 w-28 accent-teal-400"
            />
          </label>
          <button
            onClick={() => setShowGuides(!showGuides)}
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ring-white/10 transition', showGuides ? 'bg-teal-400/20 text-teal-200' : 'text-zinc-500 hover:bg-white/5')}
            title="Toggle hitbox guides"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => s.setUI({ previewOpen: false })}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/5 px-3 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" /> Exit
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
        <div
          ref={surfaceRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="relative touch-none select-none overflow-hidden rounded-lg"
          style={{
            aspectRatio: `${aspect.w} / ${aspect.h}`,
            width: 'min(100%, calc((100dvh - 5rem) * ' + aspect.w / aspect.h + '))',
            background: 'linear-gradient(135deg, #10131c 0%, #0a0c12 100%)',
          }}
        >
          {ovImage(o) && imageForDesc({ lib: s.lib }, { id: 'bg', name: '', x: 0, y: 0, w: 0, h: 0, shape: 'rect', extra: {}, image: ovImage(o) }) && (
            <img
              src={imageForDesc({ lib: s.lib }, { id: 'bg', name: '', x: 0, y: 0, w: 0, h: 0, shape: 'rect', extra: {}, image: ovImage(o) })!}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            />
          )}
          {o.descs.map((d) => {
            const img = imageForDesc({ lib: s.lib }, d);
            const rm = effectiveRangeMod(o, d);
            const isPressed = pressed.has(d.id);
            const kind = inputKind(d.name);
            if (kind === 'none') return null;
            return (
              <React.Fragment key={d.id}>
                {img ? (
                  <img
                    src={img}
                    alt={d.name}
                    draggable={false}
                    className="pointer-events-none absolute object-fill"
                    style={{
                      left: `${(d.x - d.w) * 100}%`, top: `${(d.y - d.h) * 100}%`,
                      width: `${d.w * 2 * 100}%`, height: `${d.h * 2 * 100}%`,
                      opacity: isPressed ? 1 : s.previewOpacity,
                      filter: isPressed ? 'brightness(1.35) drop-shadow(0 0 10px rgba(45,212,191,.8))' : undefined,
                      transition: 'opacity .08s, filter .08s',
                    }}
                  />
                ) : (
                  <div
                    className="pointer-events-none absolute flex items-center justify-center border-2 border-white/70"
                    style={{
                      left: `${(d.x - d.w) * 100}%`, top: `${(d.y - d.h) * 100}%`,
                      width: `${d.w * 2 * 100}%`, height: `${d.h * 2 * 100}%`,
                      borderRadius: d.shape === 'rect' ? 6 : 9999,
                      background: isPressed ? 'rgba(45,212,191,.85)' : `rgba(45,212,191,${0.35 * s.previewOpacity})`,
                      borderColor: isPressed ? '#fff' : 'rgba(255,255,255,.8)',
                      transition: 'background .08s',
                    }}
                  >
                    <span className="px-1 text-center font-semibold text-white" style={{ fontSize: 'min(1.6cqw, 12px)', textShadow: '0 1px 2px #000' }}>
                      {d.name}
                    </span>
                  </div>
                )}
                {showGuides && (
                  <div
                    className="pointer-events-none absolute border border-dashed border-amber-300/60"
                    style={{
                      left: `${(d.x - d.w * rm) * 100}%`, top: `${(d.y - d.h * rm) * 100}%`,
                      width: `${d.w * rm * 2 * 100}%`, height: `${d.h * rm * 2 * 100}%`,
                      borderRadius: d.shape === 'rect' ? 6 : 9999,
                    }}
                  />
                )}
                {isPressed && (
                  <div
                    className="pointer-events-none absolute border-[3px] border-white/90"
                    style={{
                      left: `${(d.x - d.w * rm) * 100}%`, top: `${(d.y - d.h * rm) * 100}%`,
                      width: `${d.w * rm * 2 * 100}%`, height: `${d.h * rm * 2 * 100}%`,
                      borderRadius: d.shape === 'rect' ? 6 : 9999,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-[2rem] flex-wrap items-center justify-center gap-1.5 px-4 py-2">
        {pressedNames.length === 0 ? (
          <span className="text-[11px] text-zinc-600">no button pressed</span>
        ) : (
          pressedNames.map((n) => (
            <span key={n} className="rounded-full bg-teal-400/15 px-2.5 py-0.5 font-mono text-[11px] text-teal-200 ring-1 ring-inset ring-teal-400/40">
              {n}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
