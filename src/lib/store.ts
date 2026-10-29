'use client';

import { create } from 'zustand';
import {
  CfgModel, Overlay, Desc, parseCfg, serializeCfg, newId, emptyDesc,
  ovProp, ovName, effectiveRangeMod, isPixelSpace, inferSize, normalizeOverlay,
} from './cfg';

export interface LibImage {
  /** relative path as used in cfg (e.g. "img/A.png" or "../flat/img/A.png") */
  rel: string;
  name: string;
  url: string; // object URL or data URL or site-absolute URL
  builtin?: boolean; // served from /presets (not downloadable as blob without fetch)
}

export type Aspect = { w: number; h: number; label: string };

export const ASPECTS: Aspect[] = [
  { w: 16, h: 9, label: '16:9' },
  { w: 9, h: 16, label: '9:16' },
  { w: 4, h: 3, label: '4:3' },
  { w: 3, h: 4, label: '3:4' },
  { w: 1, h: 1, label: '1:1' },
  { w: 683, h: 244, label: 'Steam Deck' },
];

export interface Project {
  fileName: string;
  model: CfgModel;
}

interface EditorState {
  /* data */
  fileName: string;
  model: CfgModel;
  cur: number;          // current overlay page
  sel: string[];        // selected desc ids
  history: string[];
  future: string[];

  /* image library */
  lib: LibImage[];

  /* ui */
  aspect: number;       // index into ASPECTS
  gridStep: number;
  showGrid: boolean;
  snapOn: boolean;
  showHitbox: boolean;
  previewOpacity: number;
  presetOpen: boolean;
  previewOpen: boolean;
  helpOpen: boolean;
  dirty: boolean;
  loaded: boolean;

  /* actions */
  setLoaded: (v: boolean) => void;
  loadCfgText: (text: string, fileName: string, mode?: 'replace' | 'append') => boolean;
  normalizePixelOverlays: (sizes?: ({ w: number; h: number } | null)[]) => void;
  newProject: (landscape: boolean) => void;
  setFileName: (n: string) => void;
  setCur: (i: number) => void;
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;

  updateDesc: (id: string, patch: Partial<Desc>, history?: boolean) => void;
  updateDescs: (ids: string[], fn: (d: Desc, i: number) => void, history?: boolean) => void;
  addDesc: (name?: string, art?: { rel: string; url: string; w?: number; h?: number }) => void;
  duplicateSel: () => void;
  deleteSel: () => void;
  reorder: (from: number, to: number) => void;

  updateOverlayProp: (key: string, val: string | null) => void;
  setOverlayName: (name: string) => void;
  addOverlay: () => void;
  duplicateOverlay: () => void;
  deleteOverlay: () => void;
  applyGeometryTo: (targetIdx: number) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  addLibImages: (imgs: LibImage[]) => void;
  removeLibImage: (rel: string) => void;

  setUI: (p: Partial<Pick<EditorState,
    'aspect' | 'gridStep' | 'showGrid' | 'snapOn' | 'showHitbox' | 'previewOpacity' |
    'presetOpen' | 'previewOpen' | 'helpOpen' | 'dirty'>>) => void;
}

const freshModel = (landscape: boolean): CfgModel => {
  const mk = (n: string): Overlay => ({
    props: [
      ['full_screen', 'true'],
      ['normalized', 'true'],
      ['name', `"${n}"`],
      ['range_mod', '1.5'],
      ['alpha_mod', '2.0'],
    ],
    descs: [],
  });
  return { top: [], overlays: [mk(landscape ? 'landscape' : 'portrait')] };
};

const snapModel = (s: Pick<EditorState, 'fileName' | 'model'>) =>
  // keys must match EditorState — undo/redo spread this snapshot into the store
  JSON.stringify({ fileName: s.fileName, model: s.model });

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const useEditor = create<EditorState>((set, get) => ({
  fileName: 'overlay.cfg',
  model: freshModel(true),
  cur: 0,
  sel: [],
  history: [],
  future: [],
  lib: [],
  aspect: 0,
  gridStep: 0.05,
  showGrid: true,
  snapOn: true,
  showHitbox: false,
  previewOpacity: 0.7,
  presetOpen: false,
  previewOpen: false,
  helpOpen: false,
  dirty: false,
  loaded: false,

  setLoaded: (v) => set({ loaded: v }),

  loadCfgText: (text, fileName, mode = 'replace') => {
    const parsed = parseCfg(text);
    if (!parsed.overlays.length) return false;
    set((s) => {
      let model: CfgModel;
      if (mode === 'append') {
        model = { top: clone(s.model.top), overlays: [...s.model.overlays, ...clone(parsed.overlays)] };
      } else {
        model = parsed;
      }
      const entry: Partial<EditorState> = {
        fileName: mode === 'replace' ? fileName : s.fileName,
        model,
        cur: mode === 'replace' ? 0 : s.model.overlays.length,
        sel: [],
        dirty: true,
      };
      return { ...entry, history: [...s.history, snapModel(s)].slice(-100), future: [] };
    });
    return true;
  },

  /** convert pixel-space overlays to normalized coords using optional per-overlay image sizes */
  normalizePixelOverlays: (sizes) => set((s) => {
    const model = clone(s.model);
    let changed = false;
    model.overlays.forEach((o, i) => {
      if (!isPixelSpace(o)) return;
      const size = sizes?.[i];
      const [W, H] = size ? [size.w, size.h] : inferSize(o);
      normalizeOverlay(o, W, H);
      changed = true;
    });
    return changed ? { model, dirty: true } : {};
  }),

  newProject: (landscape) =>
    set((s) => ({
      fileName: 'overlay.cfg',
      model: freshModel(landscape),
      cur: 0,
      sel: [],
      history: [...s.history, snapModel(s)].slice(-100),
      future: [],
      dirty: true,
    })),

  setFileName: (n) => set({ fileName: n, dirty: true }),

  setCur: (i) => set((s) => {
    const c = Math.max(0, Math.min(i, s.model.overlays.length - 1));
    return { cur: c, sel: [] };
  }),

  select: (ids) => set({ sel: ids }),

  toggleSelect: (id) => set((s) => ({
    sel: s.sel.includes(id) ? s.sel.filter((x) => x !== id) : [...s.sel, id],
  })),

  pushHistory: () => set((s) => ({
    history: [...s.history, snapModel(s)].slice(-100),
    future: [],
    dirty: true,
  })),

  undo: () => set((s) => {
    if (!s.history.length) return {};
    const prev = JSON.parse(s.history[s.history.length - 1]) as Pick<EditorState, 'fileName' | 'model'>;
    return {
      history: s.history.slice(0, -1),
      future: [snapModel(s), ...s.future].slice(0, 100),
      fileName: prev.fileName,
      model: prev.model,
      cur: Math.min(prev.model.overlays.length - 1, s.cur),
      sel: s.sel.filter((id) => prev.model.overlays.some((o: Overlay) => o.descs.some((d) => d.id === id))),
    };
  }),

  redo: () => set((s) => {
    if (!s.future.length) return {};
    const next = JSON.parse(s.future[0]) as Pick<EditorState, 'fileName' | 'model'>;
    return {
      history: [...s.history, snapModel(s)].slice(-100),
      future: s.future.slice(1),
      fileName: next.fileName,
      model: next.model,
    };
  }),

  updateDesc: (id, patch, history = true) => {
    if (history) get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      const d = model.overlays[s.cur]?.descs.find((x) => x.id === id);
      if (d) Object.assign(d, patch);
      return { model, dirty: true };
    });
  },

  updateDescs: (ids, fn, history = true) => {
    if (history) get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      for (const d of model.overlays[s.cur]?.descs ?? []) {
        const i = ids.indexOf(d.id);
        if (i >= 0) fn(d, i);
      }
      return { model, dirty: true };
    });
  },

  addDesc: (name = 'a', art) => {
    get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      const d = emptyDesc();
      d.name = name;
      // find a free-ish spot: center-top bias
      const taken = model.overlays[s.cur].descs.map((x) => x);
      let x = 0.5, y = 0.35;
      for (let tries = 0; tries < 60; tries++) {
        const row = Math.floor(tries / 6), col = tries % 6;
        x = 0.22 + col * 0.11;
        y = 0.16 + row * 0.12;
        if (!taken.some((t) => Math.abs(t.x - x) < t.w + 0.05 && Math.abs(t.y - y) < t.h + 0.05)) break;
      }
      d.x = +x.toFixed(3); d.y = +y.toFixed(3);
      let lib = s.lib;
      if (art) {
        // attach default artwork + sensible default size
        d.image = art.rel;
        if (art.w) d.w = art.w;
        if (art.h) d.h = art.h;
        if (!lib.some((l) => l.rel.toLowerCase() === art.rel.toLowerCase())) {
          lib = [...lib, { rel: art.rel, name: art.rel.split('/').pop() ?? art.rel, url: art.url, builtin: true }];
        }
      } else {
        // auto-attach icon from library if we have one for this name
        const hit = s.lib.find((l) => l.name.toLowerCase() === `${name.toLowerCase()}.png`);
        if (hit) d.image = hit.rel;
      }
      model.overlays[s.cur].descs.push(d);
      return { model, sel: [d.id], dirty: true, lib };
    });
  },

  duplicateSel: () => {
    get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      const list = model.overlays[s.cur].descs;
      const news: string[] = [];
      for (const id of s.sel) {
        const src = list.find((d) => d.id === id);
        if (!src) continue;
        const c: Desc = { ...clone(src), id: newId(), x: Math.min(0.98, src.x + 0.04), y: Math.min(0.98, src.y + 0.04) };
        list.push(c);
        news.push(c.id);
      }
      return { model, sel: news, dirty: true };
    });
  },

  deleteSel: () => {
    if (!get().sel.length) return;
    get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      const list = model.overlays[s.cur].descs;
      model.overlays[s.cur].descs = list.filter((d) => !s.sel.includes(d.id));
      return { model, sel: [], dirty: true };
    });
  },

  reorder: (from, to) => {
    get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      const list = model.overlays[s.cur].descs;
      const [d] = list.splice(from, 1);
      list.splice(to, 0, d);
      return { model, dirty: true };
    });
  },

  updateOverlayProp: (key, val) => {
    get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      const o = model.overlays[s.cur];
      const i = o.props.findIndex(([k]) => k === key);
      if (val === null || val === '') {
        if (i >= 0) o.props.splice(i, 1);
      } else if (i >= 0) o.props[i][1] = val;
      else o.props.push([key, val]);
      return { model, dirty: true };
    });
  },

  setOverlayName: (name) => {
    get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      const o = model.overlays[s.cur];
      const i = o.props.findIndex(([k]) => k === 'name');
      const v = `"${name}"`;
      if (i >= 0) o.props[i][1] = v;
      else o.props.push(['name', v]);
      return { model, dirty: true };
    });
  },

  addOverlay: () => {
    get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      model.overlays.push({
        props: [
          ['full_screen', 'true'],
          ['normalized', 'true'],
          ['name', `"overlay-${model.overlays.length + 1}"`],
          ['range_mod', '1.5'],
          ['alpha_mod', '2.0'],
        ],
        descs: [],
      });
      return { model, cur: model.overlays.length - 1, sel: [], dirty: true };
    });
  },

  duplicateOverlay: () => {
    get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      const src = model.overlays[s.cur];
      const c = clone(src);
      const nm = ovName(src);
      c.props = c.props.map(([k, v]) => (k === 'name' ? ['name', `"${nm} copy"`] : [k, v]));
      c.descs.forEach((d) => (d.id = newId()));
      model.overlays.push(c);
      return { model, cur: model.overlays.length - 1, sel: [], dirty: true };
    });
  },

  deleteOverlay: () => {
    const s = get();
    if (s.model.overlays.length <= 1) return;
    s.pushHistory();
    set((s) => {
      const model = clone(s.model);
      model.overlays.splice(s.cur, 1);
      return { model, cur: Math.max(0, s.cur - 1), sel: [], dirty: true };
    });
  },

  /** copy x/y/w/h of same-named descs from current overlay to another page */
  applyGeometryTo: (targetIdx) => {
    get().pushHistory();
    set((s) => {
      const model = clone(s.model);
      const src = model.overlays[s.cur];
      const dst = model.overlays[targetIdx];
      if (!src || !dst || src === dst) return {};
      let n = 0;
      for (const d of dst.descs) {
        const m = src.descs.find((x) => x.name === d.name);
        if (m) {
          d.x = m.x; d.y = m.y; d.w = m.w; d.h = m.h;
          n++;
        }
      }
      return { model, dirty: true };
    });
  },

  addLibImages: (imgs) => set((s) => {
    const rels = new Set(imgs.map((i) => i.rel));
    return { lib: [...s.lib.filter((l) => !rels.has(l.rel)), ...imgs], dirty: true };
  }),

  removeLibImage: (rel) => set((s) => ({ lib: s.lib.filter((l) => l.rel !== rel), dirty: true })),

  setUI: (p) => set(p),
}));

/** Resolve the display URL for a desc image (library hit by rel path, last match wins). */
export function imageForDesc(state: { lib: LibImage[] }, d: Desc): string | null {
  if (!d.image) return null;
  const rel = d.image.toLowerCase();
  let url: string | null = null;
  for (const l of state.lib) if (l.rel.toLowerCase() === rel) url = l.url;
  return url;
}

export { effectiveRangeMod, ovProp, ovName };
