'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, imageForDesc, ASPECTS, type LibImage } from '@/lib/store';
import { Desc, Overlay, effectiveRangeMod, inputKind, isCombo, COLOR, ovImage } from '@/lib/cfg';
import { cn } from '@/lib/utils';

const norm = (e: React.PointerEvent, el: HTMLElement): [number, number] => {
  const r = el.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
};

type Drag =
  | { m: 'move'; ids: string[]; start: [number, number][]; p0: [number, number]; moved: boolean; pushed: boolean }
  | { m: 'resize'; id: string; anchor: [number, number]; grab: [number, number]; ratio: number; pushed: boolean }
  | { m: 'scale'; ids: string[]; start: { x: number; y: number; w: number; h: number }[]; c: [number, number]; r0: number; pushed: boolean }
  | { m: 'marquee'; x0: number; y0: number; x1: number; y1: number };

export default function Canvas() {
  const s = useEditor();
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [marquee, setMarquee] = useState<null | { l: number; t: number; w: number; h: number }>(null);
  const [guides, setGuides] = useState<{ v?: boolean; h?: boolean }>({});
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const o = s.model.overlays[s.cur];
  const aspect = ASPECTS[s.aspect] ?? ASPECTS[0];

  const snapV = useCallback(
    (v: number) => (s.snapOn ? Math.round(v / s.gridStep) * s.gridStep : v),
    [s.snapOn, s.gridStep],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !o) return;
    const el = wrapRef.current;
    if (!el) return;
    const [nx, ny] = norm(e, el);
    const t = e.target as HTMLElement;
    const target = t.closest('[data-desc]');
    const handle = t.closest('[data-handle]')?.getAttribute('data-handle') ?? undefined;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    if (handle && s.sel.length >= 1) {
      const descs = o.descs.filter((d) => s.sel.includes(d.id));
      if (s.sel.length === 1 && descs[0]) {
        const d = descs[0];
        // anchor = the opposite (fixed) corner; the dragged corner follows the
        // pointer. `grab` records where the finger grabbed RELATIVE to the true
        // corner so the box keeps its exact size at grab time (no jump).
        const anchor: [number, number] =
          handle === 'nw' ? [d.x + d.w, d.y + d.h]
          : handle === 'ne' ? [d.x - d.w, d.y + d.h]
          : handle === 'sw' ? [d.x + d.w, d.y - d.h]
          : [d.x - d.w, d.y - d.h];
        const corner: [number, number] =
          handle === 'nw' ? [d.x - d.w, d.y - d.h]
          : handle === 'ne' ? [d.x + d.w, d.y - d.h]
          : handle === 'sw' ? [d.x - d.w, d.y + d.h]
          : [d.x + d.w, d.y + d.h];
        dragRef.current = { m: 'resize', id: d.id, anchor, grab: [nx - corner[0], ny - corner[1]], ratio: Math.max(0.0001, d.w / Math.max(0.0001, d.h)), pushed: false };
      } else {
        const cx = descs.reduce((a, d) => a + d.x, 0) / descs.length;
        const cy = descs.reduce((a, d) => a + d.y, 0) / descs.length;
        dragRef.current = {
          m: 'scale',
          ids: descs.map((d) => d.id),
          start: descs.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h })),
          c: [cx, cy],
          r0: Math.hypot(nx - cx, ny - cy) || 0.01,
          pushed: false,
        };
      }
      return;
    }

    if (target) {
      const id = (target as HTMLElement).dataset.desc!;
      if (e.shiftKey) {
        s.toggleSelect(id);
        return;
      }
      const ids = s.sel.includes(id) ? s.sel : [id];
      if (!s.sel.includes(id)) s.select([id]);
      // history is pushed lazily on the first real move (avoids undo noise on plain clicks)
      const start = o.descs.filter((d) => ids.includes(d.id)).map((d) => [d.x, d.y] as [number, number]);
      dragRef.current = { m: 'move', ids, start, p0: [nx, ny], moved: false, pushed: false };
      return;
    }

    if (!e.shiftKey && s.sel.length) s.select([]);
    dragRef.current = { m: 'marquee', x0: nx, y0: ny, x1: nx, y1: ny };
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const [nx, ny] = norm(e, el);
      setCursor([nx, ny]);
      const dr = dragRef.current;
      if (!dr) return;

      if (dr.m === 'move') {
        if (!dr.moved && Math.hypot(nx - dr.p0[0], ny - dr.p0[1]) * el.getBoundingClientRect().width < 3) return;
        if (!dr.moved && !dr.pushed) { s.pushHistory(); dr.pushed = true; }
        dr.moved = true;
        const canSnap = s.snapOn && !e.altKey; // hold Alt to bypass the grid
        const rx = dr.start[0][0] + (nx - dr.p0[0]);
        const ry = dr.start[0][1] + (ny - dr.p0[1]);
        let dx = (canSnap ? snapV(rx) : rx) - dr.start[0][0];
        let dy = (canSnap ? snapV(ry) : ry) - dr.start[0][1];
        const g: { v?: boolean; h?: boolean } = {};
        if (canSnap) {
          for (const c of [0.5, 0, 1]) {
            if (Math.abs(rx - c) < s.gridStep / 3) { dx = c - dr.start[0][0]; g.v = true; }
            if (Math.abs(ry - c) < s.gridStep / 3) { dy = c - dr.start[0][1]; g.h = true; }
          }
        }
        setGuides(g);
        s.updateDescs(dr.ids, (d, i) => {
          d.x = +(dr.start[i][0] + dx).toFixed(5);
          d.y = +(dr.start[i][1] + dy).toFixed(5);
        }, false);
        return;
      }
      if (dr.m === 'resize') {
        if (!dr.pushed) { s.pushHistory(); dr.pushed = true; }
        // pointer corrected for where the handle was grabbed → half-extents are
        // exactly (w, h) at grab time and only change as the pointer moves
        const px = nx - dr.grab[0];
        const py = ny - dr.grab[1];
        const canSnap = s.snapOn && !e.altKey && !e.shiftKey; // Alt bypasses, Shift locks ratio
        const cx = canSnap ? snapV(px) : px;
        const cy = canSnap ? snapV(py) : py;
        // half-extents = distance from the fixed corner to the pointer;
        // center = corner moved TOWARD the pointer by those half-extents
        let w = Math.max(0.002, Math.abs(cx - dr.anchor[0]));
        let h = Math.max(0.002, Math.abs(cy - dr.anchor[1]));
        if (e.shiftKey) {
          // keep the original w:h aspect ratio
          if (w / h > dr.ratio) h = w / dr.ratio;
          else w = h * dr.ratio;
        }
        const x = dr.anchor[0] + (cx >= dr.anchor[0] ? w : -w);
        const y = dr.anchor[1] + (cy >= dr.anchor[1] ? h : -h);
        s.updateDesc(dr.id, { x: +x.toFixed(5), y: +y.toFixed(5), w: +w.toFixed(5), h: +h.toFixed(5) }, false);
        setSize({ w, h });
        return;
      }
      if (dr.m === 'scale') {
        if (!dr.pushed) { s.pushHistory(); dr.pushed = true; }
        const r = Math.max(0.01, Math.hypot(nx - dr.c[0], ny - dr.c[1]));
        const f = Math.min(12, Math.max(0.05, r / dr.r0));
        s.updateDescs(dr.ids, (d, i) => {
          const b = dr.start[i];
          d.x = +(dr.c[0] + (b.x - dr.c[0]) * f).toFixed(5);
          d.y = +(dr.c[1] + (b.y - dr.c[1]) * f).toFixed(5);
          d.w = +(b.w * f).toFixed(5);
          d.h = +(b.h * f).toFixed(5);
        }, false);
        return;
      }
      if (dr.m === 'marquee') {
        dr.x1 = nx; dr.y1 = ny;
        setMarquee({
          l: Math.min(dr.x0, dr.x1) * 100,
          t: Math.min(dr.y0, dr.y1) * 100,
          w: Math.abs(dr.x1 - dr.x0) * 100,
          h: Math.abs(dr.y1 - dr.y0) * 100,
        });
      }
    },
    [s, snapV],
  );

  const onPointerUp = useCallback(() => {
    const dr = dragRef.current;
    dragRef.current = null;
    setGuides({});
    setSize(null);
    if (dr?.m === 'marquee' && o) {
      const l = Math.min(dr.x0, dr.x1), r = Math.max(dr.x0, dr.x1);
      const t = Math.min(dr.y0, dr.y1), b = Math.max(dr.y0, dr.y1);
      const hits = o.descs
        .filter((d) => d.x >= l - d.w && d.x <= r + d.w && d.y >= t - d.h && d.y <= b + d.h)
        .map((d) => d.id);
      if (hits.length) s.select(hits);
    }
    setMarquee(null);
  }, [o, s]);

  // keyboard: nudge / delete / duplicate
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (s.presetOpen || s.previewOpen || s.helpOpen) return;
      if (!s.sel.length) return;
      const map: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      if (map[e.key]) {
        e.preventDefault();
        const st = e.shiftKey ? 0.02 : 0.0025;
        const [dx, dy] = map[e.key];
        s.updateDescs(s.sel, (d) => {
          d.x = +(d.x + dx * st).toFixed(5);
          d.y = +(d.y + dy * st).toFixed(5);
        });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.deleteSel();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSel();
      } else if (e.key === 'Escape') {
        s.select([]);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [s]);

  if (!o) return null;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-3 md:p-6" style={{ containerType: 'size' }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(45,212,191,.08), transparent 70%)' }}
      />
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative touch-none select-none overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/60"
        style={{
          aspectRatio: `${aspect.w} / ${aspect.h}`,
          // container-query sizing: always fills the ACTUAL available space
          // (header, tabs and mobile panels are all accounted for automatically)
          width: `min(100%, calc(100cqh * ${(aspect.w / aspect.h).toFixed(6)}))`,
          background: 'repeating-conic-gradient(#18181b 0% 25%, #131316 0% 50%) 50% / 28px 28px',
        }}
      >
        {/* page background image (overlay-level `overlay` key) */}
        <PageBackground o={o} lib={s.lib} />

        {s.showGrid && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {Array.from({ length: Math.round(1 / s.gridStep) - 1 }, (_, i) => {
              const k = (i + 1) * s.gridStep;
              const mid = Math.round(k * 1000) === 500;
              return (
                <g key={i}>
                  <line x1={`${k * 100}%`} y1="0" x2={`${k * 100}%`} y2="100%" stroke={mid ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.10)'} strokeWidth="1" />
                  <line x1="0" y1={`${k * 100}%`} x2="100%" y2={`${k * 100}%`} stroke={mid ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.10)'} strokeWidth="1" />
                </g>
              );
            })}
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(45,212,191,.35)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(45,212,191,.35)" strokeWidth="1" strokeDasharray="4 4" />
          </svg>
        )}

        {o.descs.map((d) => (
          <ElementView key={d.id} d={d} o={o} selected={s.sel.includes(d.id)} showHitbox={s.showHitbox} lib={s.lib} />
        ))}

        <SingleHandles o={o} sel={s.sel} />
        <MultiHandles o={o} sel={s.sel} />

        {marquee && (
          <div
            className="pointer-events-none absolute z-30 rounded border border-teal-300/80 bg-teal-300/10"
            style={{ left: `${marquee.l}%`, top: `${marquee.t}%`, width: `${marquee.w}%`, height: `${marquee.h}%` }}
          />
        )}
        {guides.v && <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-px bg-teal-300/80" />}
        {guides.h && <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-px bg-teal-300/80" />}

        {o.descs.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-zinc-400">This page has no buttons yet</p>
            <p className="text-xs text-zinc-500">Add one from the left panel or load a preset</p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-2 left-1/2 z-40 flex max-w-[95%] -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-zinc-900/85 px-3 py-1.5 font-mono text-[10px] text-zinc-400 backdrop-blur sm:gap-3 sm:px-4 sm:text-[11px]">
        <span className="hidden sm:inline">x {(cursor[0] * 100).toFixed(1)}% · y {(cursor[1] * 100).toFixed(1)}%</span>
        <span className="sm:hidden">{o.descs.length} el</span>
        <span className="hidden text-zinc-600 sm:inline">|</span>
        <span className="hidden sm:inline">{o.descs.length} elements</span>
        {size && (
          <>
            <span className="text-zinc-600">|</span>
            <span className="text-amber-300">{(size.w * 200).toFixed(1)}% × {(size.h * 200).toFixed(1)}%</span>
          </>
        )}
        {s.sel.length > 0 && (
          <>
            <span className="text-zinc-600">|</span>
            <span className="text-teal-300">{s.sel.length} selected</span>
          </>
        )}
        {s.snapOn && (
          <>
            <span className="text-zinc-600">|</span>
            <span className="text-teal-300/80" title="Snap to grid is on — hold Alt to bypass">snap {+(s.gridStep * 100).toFixed(2)}%</span>
          </>
        )}
      </div>
    </div>
  );
}

function Handle({ h }: { h: 'nw' | 'ne' | 'sw' | 'se' }) {
  // hit zone = 28px on normal elements, but shrinks with the box (≤55% per
  // axis) so the four zones never blanket a tiny element — its body stays
  // draggable and the corners stay individually grabbable on phones
  const zone = { width: 'min(1.75rem, 55%)', height: 'min(1.75rem, 55%)' };
  return (
    <div
      data-handle={h}
      style={zone}
      className={cn(
        'pointer-events-auto absolute flex items-center justify-center',
        h === 'nw' && '-left-[27.5%] -top-[27.5%] cursor-nwse-resize',
        h === 'ne' && '-right-[27.5%] -top-[27.5%] cursor-nesw-resize',
        h === 'sw' && '-bottom-[27.5%] -left-[27.5%] cursor-nesw-resize',
        h === 'se' && '-bottom-[27.5%] -right-[27.5%] cursor-nwse-resize',
      )}
    >
      <div className="h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-teal-300 shadow-md ring-1 ring-teal-300/40 transition-transform hover:scale-125" />
    </div>
  );
}

function SingleHandles({ o, sel }: { o: { descs: Desc[] }; sel: string[] }) {
  if (sel.length !== 1) return null;
  const d = o.descs.find((x) => x.id === sel[0]);
  if (!d) return null;
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left: `${(d.x - d.w) * 100}%`, top: `${(d.y - d.h) * 100}%`, width: `${d.w * 2 * 100}%`, height: `${d.h * 2 * 100}%` }}
    >
      {(['nw', 'ne', 'sw', 'se'] as const).map((h) => <Handle key={h} h={h} />)}
    </div>
  );
}

function MultiHandles({ o, sel }: { o: { descs: Desc[] }; sel: string[] }) {
  if (sel.length <= 1) return null;
  const ds = o.descs.filter((d) => sel.includes(d.id));
  if (!ds.length) return null;
  const x0 = Math.min(...ds.map((d) => d.x - d.w));
  const x1 = Math.max(...ds.map((d) => d.x + d.w));
  const y0 = Math.min(...ds.map((d) => d.y - d.h));
  const y1 = Math.max(...ds.map((d) => d.y + d.h));
  return (
    <div
      className="pointer-events-none absolute z-20 border border-dashed border-teal-300/70"
      style={{ left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` }}
    >
      {(['nw', 'ne', 'sw', 'se'] as const).map((h) => <Handle key={h} h={h} />)}
    </div>
  );
}

function PageBackground({ o, lib }: { o: Overlay; lib: LibImage[] }) {
  const ref = ovImage(o);
  const url = ref ? imageForDesc({ lib }, { id: 'bg', name: '', x: 0, y: 0, w: 0, h: 0, shape: 'rect', extra: {}, image: ref }) : null;
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full object-fill"
    />
  );
}

function ElementView({ d, o, selected, showHitbox, lib }: {
  d: Desc;
  o: Overlay;
  selected: boolean;
  showHitbox: boolean;
  lib: LibImage[];
}) {
  const kind = inputKind(d.name);
  const color = COLOR[kind];
  const img = imageForDesc({ lib }, d);
  const rm = effectiveRangeMod(o, d);
  const dim = kind === 'none' || kind === 'area';
  // combo hitboxes (e.g. left|up) are auxiliary invisible zones in RetroArch —
  // render them as faint dashed outlines so they don't cover the artwork
  const combo = isCombo(d.name);

  return (
    <>
      {showHitbox && rm !== 1 && d.w > 0 && (
        <div
          className={cn('pointer-events-none absolute z-10 border border-dashed', selected ? 'border-teal-300/80' : 'border-amber-300/50')}
          style={{
            left: `${(d.x - d.w * rm) * 100}%`,
            top: `${(d.y - d.h * rm) * 100}%`,
            width: `${d.w * rm * 2 * 100}%`,
            height: `${d.h * rm * 2 * 100}%`,
            borderRadius: d.shape === 'rect' ? 4 : 9999,
          }}
          title={`hitbox ×${rm}`}
        />
      )}
      <div
        data-desc={d.id}
        className="absolute z-10 flex items-center justify-center"
        style={{
          left: `${(d.x - d.w) * 100}%`,
          top: `${(d.y - d.h) * 100}%`,
          width: `${d.w * 2 * 100}%`,
          height: `${d.h * 2 * 100}%`,
          cursor: 'grab',
        }}
      >
        {img ? (
          <>
            <img
              src={img}
              alt={d.name}
              draggable={false}
              className="pointer-events-none h-full w-full object-fill"
              style={{ opacity: dim ? 0.35 : 1 }}
            />
            {selected && <div className="pointer-events-none absolute -inset-[2px] rounded ring-2 ring-teal-300" />}
          </>
        ) : (
          <div
            className={cn('pointer-events-none flex h-full w-full items-center justify-center border-2', d.shape === 'rect' ? 'rounded' : 'rounded-full')}
            style={{
              background: dim || combo ? 'transparent' : `${color}${selected ? '55' : '2e'}`,
              borderStyle: dim || combo ? 'dashed' : 'solid',
              borderColor: selected ? undefined : dim ? 'rgba(255,255,255,.25)' : combo ? `${color}66` : `${color}88`,
            }}
          >
            <span
              className="truncate px-0.5 text-center font-semibold leading-none text-white"
              style={{
                fontSize: 'min(1.6cqw, 12px)',
                textShadow: '0 1px 2px rgba(0,0,0,.9)',
                visibility: combo && !selected ? 'hidden' : 'visible',
              }}
            >
              {d.name}
            </span>
            {selected && (
              <div className={cn('pointer-events-none absolute -inset-[2px]', d.shape === 'rect' ? 'rounded' : 'rounded-full', 'ring-2 ring-teal-300')} />
            )}
          </div>
        )}
      </div>
    </>
  );
}
