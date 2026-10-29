'use client';

import React, { useState } from 'react';
import { useEditor } from '@/lib/store';
import { Desc, sanitizeDescName, ovProp, ovName, BUTTONS, quoteIfNeeded } from '@/lib/cfg';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Trash2, Copy, FlipHorizontal2, FlipVertical2, ChevronDown, X, Link2, Image as ImageIcon,
} from 'lucide-react';

function NumField({ label, value, onChange, step = 0.001, min, max }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  const [txt, setTxt] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setTxt(String(value));
  }
  const commit = (v: string) => {
    const n = parseFloat(v);
    if (Number.isFinite(n)) {
      let c = n;
      if (min !== undefined) c = Math.max(min, c);
      if (max !== undefined) c = Math.min(max, c);
      onChange(+c.toFixed(5));
    } else setTxt(String(value));
  };
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={txt}
        onChange={(e) => {
          setTxt(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) {
            let c = n;
            if (min !== undefined) c = Math.max(min, c);
            if (max !== undefined) c = Math.min(max, c);
            onChange(+c.toFixed(5));
          }
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
        className="h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 font-mono text-xs text-zinc-200 outline-none transition focus:border-teal-400/60 focus:ring-1 focus:ring-teal-400/30"
      />
    </label>
  );
}

function TextField({ label, value, onChange, placeholder, mono = true }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  const [txt, setTxt] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setTxt(value);
  }
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        value={txt}
        placeholder={placeholder}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => onChange(txt.trim())}
        onKeyDown={(e) => { if (e.key === 'Enter') onChange(txt.trim()); }}
        className={cn(
          'h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-teal-400/60 focus:ring-1 focus:ring-teal-400/30',
          mono && 'font-mono',
        )}
      />
    </label>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{title}</h3>
        <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-600 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </div>
  );
}

function DescProps({ d }: { d: Desc }) {
  const s = useEditor();
  return (
    <>
      <Section title="Input">
        <TextField
          label="name (input id)"
          value={d.name}
          onChange={(v) => {
            const clean = sanitizeDescName(v);
            if (clean) s.updateDesc(d.id, { name: clean });
          }}
          placeholder="a, left|up, save_state…"
        />
        <div className="flex flex-wrap gap-1">
          {['a', 'b', 'x', 'y', 'start', 'select', 'l', 'r', 'menu_toggle', 'overlay_next', 'nul'].map((n) => (
            <button
              key={n}
              onClick={() => s.updateDesc(d.id, { name: n })}
              className={cn(
                'rounded-md px-2 py-1 font-mono text-[10px] ring-1 ring-inset transition',
                d.name === n ? 'bg-teal-400/20 text-teal-200 ring-teal-400/40' : 'bg-white/5 text-zinc-400 ring-white/10 hover:bg-white/10',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Geometry">
        <div className="grid grid-cols-2 gap-2">
          <NumField label="x" value={d.x} min={-2} max={3} onChange={(v) => s.updateDesc(d.id, { x: v }, false)} />
          <NumField label="y" value={d.y} min={-2} max={3} onChange={(v) => s.updateDesc(d.id, { y: v }, false)} />
          <NumField label="w (half-width)" value={d.w} min={0.001} onChange={(v) => s.updateDesc(d.id, { w: v }, false)} />
          <NumField label="h (half-height)" value={d.h} min={0.001} onChange={(v) => s.updateDesc(d.id, { h: v }, false)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">shape</span>
          <div className="flex overflow-hidden rounded-lg ring-1 ring-inset ring-white/10">
            {(['radial', 'rect'] as const).map((sh) => (
              <button
                key={sh}
                onClick={() => s.updateDesc(d.id, { shape: sh })}
                className={cn(
                  'px-3 py-1 font-mono text-[11px] transition',
                  d.shape === sh ? 'bg-teal-400/20 text-teal-200' : 'text-zinc-400 hover:bg-white/5',
                )}
              >
                {sh}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => s.updateDesc(d.id, { x: 0.5 })} title="Center horizontally">
              <FlipHorizontal2 className="h-3 w-3" /> H
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => s.updateDesc(d.id, { y: 0.5 })} title="Center vertically">
              <FlipVertical2 className="h-3 w-3" /> V
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Hitbox & reach">
        <div className="grid grid-cols-2 gap-2">
          <TextField label="range_mod (desc)" value={d.rangeMod ?? ''} onChange={(v) => s.updateDesc(d.id, { rangeMod: v || undefined })} placeholder="overlay default" />
          <TextField label="exclusive" value={d.exclusive ?? ''} onChange={(v) => s.updateDesc(d.id, { exclusive: v || undefined })} placeholder="true / false" />
          <TextField label="reach_x" value={d.reachX ?? ''} onChange={(v) => s.updateDesc(d.id, { reachX: v || undefined })} />
          <TextField label="reach_y" value={d.reachY ?? ''} onChange={(v) => s.updateDesc(d.id, { reachY: v || undefined })} />
          <TextField label="reach_up" value={d.reachUp ?? ''} onChange={(v) => s.updateDesc(d.id, { reachUp: v || undefined })} />
          <TextField label="reach_down" value={d.reachDown ?? ''} onChange={(v) => s.updateDesc(d.id, { reachDown: v || undefined })} />
          <TextField label="reach_left" value={d.reachLeft ?? ''} onChange={(v) => s.updateDesc(d.id, { reachLeft: v || undefined })} />
          <TextField label="reach_right" value={d.reachRight ?? ''} onChange={(v) => s.updateDesc(d.id, { reachRight: v || undefined })} />
        </div>
        <p className="text-[10px] leading-relaxed text-zinc-500">
          The graphic always renders at w×h. range_mod only enlarges the touch area while the button is pressed.
        </p>
      </Section>

      <Section title="Image">
        <TextField
          label="path (relative to .cfg)"
          value={d.image ?? ''}
          onChange={(v) => s.updateDesc(d.id, { image: v || undefined })}
          placeholder="img/A.png"
        />
        {s.lib.length > 0 && (
          <div className="overlay-scroll flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-1.5">
            {s.lib.slice(0, 60).map((l) => (
              <button
                key={l.rel + l.url}
                onClick={() => s.updateDesc(d.id, { image: l.rel })}
                title={l.rel}
                className={cn(
                  'h-9 w-9 overflow-hidden rounded-md ring-1 ring-inset transition hover:scale-105',
                  d.image?.toLowerCase() === l.rel.toLowerCase() ? 'ring-2 ring-teal-300' : 'ring-white/10',
                )}
              >
                <img src={l.url} alt={l.name} className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
        {d.image && (
          <button
            onClick={() => s.updateDesc(d.id, { image: undefined })}
            className="inline-flex items-center gap-1 text-[11px] text-rose-400/90 hover:text-rose-300"
          >
            <X className="h-3 w-3" /> Remove image reference
          </button>
        )}
      </Section>

      <Section title="Advanced" defaultOpen={false}>
        <TextField
          label="next_target"
          value={d.nextTarget ?? ''}
          onChange={(v) => s.updateDesc(d.id, { nextTarget: v || undefined })}
          placeholder="overlay1_desc0"
        />
        {Object.entries(d.extra).length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <Link2 className="h-3 w-3" /> preserved keys
            </p>
            <div className="space-y-1">
              {Object.entries(d.extra).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                  <span className="text-amber-300/80">{k}</span>
                  <span>= {v}</span>
                  <button
                    className="ml-auto text-zinc-600 hover:text-rose-400"
                    onClick={() => {
                      const extra = { ...d.extra };
                      delete extra[k];
                      s.updateDesc(d.id, { extra });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <div className="flex gap-2 p-3">
        <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 border-white/10 text-xs" onClick={s.duplicateSel}>
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </Button>
        <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 border-rose-500/20 text-xs text-rose-300 hover:bg-rose-500/10 hover:text-rose-200" onClick={s.deleteSel}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </>
  );
}

function PageProps() {
  const s = useEditor();
  const o = s.model.overlays[s.cur];
  const [newKey, setNewKey] = useState('');
  const [applyTo, setApplyTo] = useState('');
  if (!o) return null;
  const name = ovName(o);
  const known = new Set(['name', 'range_mod', 'alpha_mod', 'full_screen', 'normalized']);
  const others = o.props.filter(([k]) => !known.has(k));

  return (
    <>
      <Section title="Page">
        <TextField label="name" value={name} mono={false} onChange={(v) => s.setOverlayName(v || 'overlay')} />
        <div className="grid grid-cols-2 gap-2">
          <TextField label="range_mod" value={ovProp(o, 'range_mod')} onChange={(v) => s.updateOverlayProp('range_mod', v)} />
          <TextField label="alpha_mod" value={ovProp(o, 'alpha_mod')} onChange={(v) => s.updateOverlayProp('alpha_mod', v)} />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
          <span className="font-mono text-[11px] text-zinc-400">full_screen</span>
          <Switch
            checked={ovProp(o, 'full_screen') === 'true'}
            onCheckedChange={(v) => s.updateOverlayProp('full_screen', String(v))}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
          <span className="font-mono text-[11px] text-zinc-400">normalized</span>
          <Switch
            checked={ovProp(o, 'normalized') === 'true'}
            onCheckedChange={(v) => s.updateOverlayProp('normalized', String(v))}
          />
        </div>
      </Section>

      <Section title="Extra file keys" defaultOpen={others.length > 0}>
        {others.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate font-mono text-[10px] text-amber-300/80" title={k}>{k}</span>
            <input
              value={v}
              onChange={(e) => {
                s.updateOverlayProp(k, e.target.value);
              }}
              className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 font-mono text-[10px] text-zinc-300 outline-none focus:border-teal-400/60"
            />
            <button onClick={() => s.updateOverlayProp(k, null)} className="text-zinc-600 hover:text-rose-400">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-1">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="new key…"
            className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 font-mono text-[10px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-teal-400/60"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-white/10 px-2 text-[10px]"
            disabled={!newKey.trim()}
            onClick={() => {
              s.updateOverlayProp(newKey.trim(), quoteIfNeeded(''));
              setNewKey('');
            }}
          >
            Add
          </Button>
        </div>
      </Section>

      <Section title="Page actions">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-8 border-white/10 text-xs" onClick={s.addOverlay}>Add page</Button>
          <Button variant="outline" size="sm" className="h-8 border-white/10 text-xs" onClick={s.duplicateOverlay}>Duplicate</Button>
        </div>
        {s.model.overlays.length > 1 && (
          <>
            <div className="flex gap-1">
              <select
                value={applyTo}
                onChange={(e) => setApplyTo(e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-zinc-300 outline-none focus:border-teal-400/60"
              >
                <option value="">Copy geometry to…</option>
                {s.model.overlays.map((oo, i) =>
                  i === s.cur ? null : (
                    <option key={i} value={i}>
                      {ovName(oo)} ({i})
                    </option>
                  ),
                )}
              </select>
              <Button
                size="sm"
                className="h-8 bg-teal-400/15 px-3 text-xs text-teal-200 hover:bg-teal-400/25"
                disabled={applyTo === ''}
                onClick={() => {
                  s.applyGeometryTo(parseInt(applyTo));
                  setApplyTo('');
                }}
              >
                Apply
              </Button>
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-500">
              Copies x/y/w/h of elements with the same name — handy for keeping A/B variants aligned.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full gap-1.5 border-rose-500/20 text-xs text-rose-300 hover:bg-rose-500/10"
              onClick={s.deleteOverlay}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete this page
            </Button>
          </>
        )}
      </Section>
    </>
  );
}

export default function PropertiesPanel() {
  const s = useEditor();
  const o = s.model.overlays[s.cur];
  const d = o?.descs.find((x) => x.id === s.sel[0]);
  const multi = s.sel.length > 1;

  return (
    <div className="overlay-scroll min-h-0 flex-1 overflow-y-auto">
      {multi ? (
        <>
          <div className="border-b border-white/5 px-3 py-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{s.sel.length} elements selected</h3>
            <p className="mt-1 text-[11px] text-zinc-500">Drag a corner handle to scale the group. Shift-click adds more.</p>
          </div>
          <Section title="Actions">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-8 border-white/10 text-xs" onClick={s.duplicateSel}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
              </Button>
              <Button variant="outline" size="sm" className="h-8 border-rose-500/20 text-xs text-rose-300 hover:bg-rose-500/10" onClick={s.deleteSel}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-8 border-white/10 text-xs" onClick={() => s.updateDescs(s.sel, (x) => { x.x = 0.5; })}>
                Center X
              </Button>
              <Button variant="outline" size="sm" className="h-8 border-white/10 text-xs" onClick={() => s.updateDescs(s.sel, (x) => { x.y = 0.5; })}>
                Center Y
              </Button>
            </div>
          </Section>
        </>
      ) : d ? (
        <DescProps d={d} />
      ) : (
        <PageProps />
      )}
    </div>
  );
}
