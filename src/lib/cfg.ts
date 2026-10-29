/**
 * RetroArch overlay .cfg parser / serializer.
 *
 * Grammar (official libretro overlays):
 *   overlays = 3
 *   overlay0_full_screen = true
 *   overlay0_normalized  = true
 *   overlay0_name        = "landscape"
 *   overlay0_range_mod   = 1.5
 *   overlay0_descs = 21
 *   overlay0_desc0 = "dpad_area,0.15,0.75,rect,0.15,0.27"
 *   overlay0_desc0_reach_x = 1.9
 *   overlay0_desc0_overlay = ../flat/img/dpad-left.png
 *
 * desc fields (always 6): name, x, y, shape(radial|rect), w, h  — normalized 0..1.
 * Any `overlayN_descM_key = value` not modeled below is preserved verbatim.
 */

export type Shape = 'radial' | 'rect';

export interface Desc {
  /** stable runtime id (not serialized) */
  id: string;
  /** input name: "a", "left|up", "nul", "dpad_area", "save_state", "retrok_space"... */
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: Shape;
  /** per-desc image (key: overlay) — raw path, no quotes */
  image?: string;
  /** per-desc hitbox scale (key: range_mod) — takes priority over overlay-level */
  rangeMod?: string;
  /** per-desc exclusive (key: range_mod_exclusive) */
  rangeModExclusive?: string;
  /** keyboard/mouse/joy expansion (keys: reach_x / reach_y) */
  reachX?: string;
  reachY?: string;
  reachUp?: string;
  reachDown?: string;
  reachLeft?: string;
  reachRight?: string;
  /** link to another overlay page (key: next_target) */
  nextTarget?: string;
  /** key: exclusive */
  exclusive?: string;
  /** anything else we don't model */
  extra: Record<string, string>;
}

export interface Overlay {
  /** preserve unknown/known props verbatim, in file order */
  props: [string, string][];
  descs: Desc[];
}

export interface CfgModel {
  /** top-level keys other than `overlays` (rare) */
  top: [string, string][];
  overlays: Overlay[];
}

let uid = 0;
export const newId = () => `d${Date.now().toString(36)}${(uid++).toString(36)}`;

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
export const unquote = (s: string) => s.replace(/^"([\s\S]*)"$/, '$1');
export const quoteIfNeeded = (s: string) => (/[\s,;]/.test(s) ? `"${s}"` : s);

const DESC_MAIN = /^overlay(\d+)_desc(\d+)\s*=\s*"(.*)"\s*$/;
const DESC_EXTRA = /^overlay(\d+)_desc(\d+)_(\w+)\s*=\s*(.*)$/;
const OVERLAY_PROP = /^overlay(\d+)_(\w+)\s*=\s*(.*)$/;
const TOP_PROP = /^([A-Za-z_]\w*)\s*=\s*(.*)$/;
const COUNT = /^overlays\s*=\s*(\d+)\s*$/;

export function parseCfg(text: string): CfgModel {
  const top: [string, string][] = [];
  const ovMap = new Map<number, Overlay>();
  const get = (n: number): Overlay => {
    let o = ovMap.get(n);
    if (!o) {
      o = { props: [], descs: [] };
      ovMap.set(n, o);
    }
    return o;
  };
  let declared = 0;

  for (const raw of stripBom(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let m: RegExpExecArray | null;
    if ((m = DESC_MAIN.exec(line))) {
      const o = get(+m[1]);
      const f = m[3].split(',');
      while (o.descs.length <= +m[2]) o.descs.push(emptyDesc());
      const d = o.descs[+m[2]];
      d.name = (f[0] ?? 'nul').trim();
      d.x = num(f[1]);
      d.y = num(f[2]);
      d.shape = (f[3] ?? 'radial').trim() === 'rect' ? 'rect' : 'radial';
      d.w = num(f[4]);
      d.h = num(f[5]);
      continue;
    }
    if ((m = DESC_EXTRA.exec(line))) {
      const o = get(+m[1]);
      while (o.descs.length <= +m[2]) o.descs.push(emptyDesc());
      const d = o.descs[+m[2]];
      const k = m[3];
      const v = m[4].trim();
      switch (k) {
        case 'overlay': d.image = unquote(v); break;
        case 'range_mod': d.rangeMod = v; break;
        case 'range_mod_exclusive': d.rangeModExclusive = v; break;
        case 'reach_x': d.reachX = v; break;
        case 'reach_y': d.reachY = v; break;
        case 'reach_up': d.reachUp = v; break;
        case 'reach_down': d.reachDown = v; break;
        case 'reach_left': d.reachLeft = v; break;
        case 'reach_right': d.reachRight = v; break;
        case 'next_target': d.nextTarget = unquote(v); break;
        case 'exclusive': d.exclusive = v; break;
        default: d.extra[k] = v;
      }
      continue;
    }
    if ((m = OVERLAY_PROP.exec(line))) {
      if (m[2] === 'descs') continue;
      get(+m[1]).props.push([m[2], m[3].trim()]);
      continue;
    }
    if ((m = COUNT.exec(line))) {
      declared = +m[1];
      continue;
    }
    if ((m = TOP_PROP.exec(line))) {
      top.push([m[1], m[2].trim()]);
    }
  }

  const overlays = [...ovMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, o]) => o);
  // pad to declared count (files sometimes declare more overlays than define)
  while (overlays.length < declared) overlays.push({ props: [], descs: [] });
  overlays.forEach((o) => {
    o.descs = o.descs.filter((d) => d.name !== '' || d.w !== 0);
    o.descs.forEach((d) => (d.id = newId()));
  });
  return { top, overlays };
}

const num = (s: string | undefined) => {
  const n = parseFloat((s ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

export function emptyDesc(): Desc {
  return { id: newId(), name: 'a', x: 0.5, y: 0.5, w: 0.05, h: 0.05, shape: 'radial', extra: {} };
}

const f5 = (v: number) => {
  const s = (Math.round(v * 1e5) / 1e5).toFixed(5);
  return s === '-0.00000' ? '0.00000' : s;
};

export function serializeCfg(m: CfgModel): string {
  const out: string[] = [];
  for (const [k, v] of m.top) out.push(`${k} = ${v}`);
  out.push(`overlays = ${m.overlays.length}`);
  m.overlays.forEach((o, i) => {
    out.push('');
    for (const [k, v] of o.props) out.push(`overlay${i}_${k} = ${v}`);
    out.push('');
    out.push(`overlay${i}_descs = ${o.descs.length}`);
    out.push('');
    o.descs.forEach((d, j) => {
      out.push(
        `overlay${i}_desc${j} = "${d.name},${f5(d.x)},${f5(d.y)},${d.shape},${f5(d.w)},${f5(d.h)}"`,
      );
      const kv: [string, string | undefined][] = [
        ['overlay', d.image],
        ['range_mod', d.rangeMod],
        ['range_mod_exclusive', d.rangeModExclusive],
        ['reach_x', d.reachX],
        ['reach_y', d.reachY],
        ['reach_up', d.reachUp],
        ['reach_down', d.reachDown],
        ['reach_left', d.reachLeft],
        ['reach_right', d.reachRight],
        ['next_target', d.nextTarget !== undefined ? quoteIfNeeded(d.nextTarget) : undefined],
        ['exclusive', d.exclusive],
      ];
      for (const [k, v] of kv) if (v !== undefined && v !== '') out.push(`overlay${i}_desc${j}_${k} = ${v}`);
      for (const [k, v] of Object.entries(d.extra)) out.push(`overlay${i}_desc${j}_${k} = ${v}`);
    });
  });
  return out.join('\n') + '\n';
}

/* ---------- promoted overlay props ---------- */

export function ovProp(o: Overlay, key: string): string {
  const p = o.props.find(([k]) => k === key);
  return p ? p[1] : '';
}
export function setOvProp(o: Overlay, key: string, val: string | null) {
  const i = o.props.findIndex(([k]) => k === key);
  if (val === null || val === '') {
    if (i >= 0) o.props.splice(i, 1);
  } else if (i >= 0) {
    o.props[i][1] = val;
  } else {
    o.props.push([key, val]);
  }
}
export const ovName = (o: Overlay) => unquote(ovProp(o, 'name') || `overlay`);

/**
 * Effective hitbox scale for a desc: desc-level range_mod wins,
 * then overlay-level, then 1.
 */
export function effectiveRangeMod(o: Overlay, d: Desc): number {
  const v = d.rangeMod !== undefined && d.rangeMod !== '' ? parseFloat(d.rangeMod) : NaN;
  if (Number.isFinite(v) && v > 0) return v;
  const ov = parseFloat(ovProp(o, 'range_mod'));
  return Number.isFinite(ov) && ov > 0 ? ov : 1;
}

/** overlay-level background image (key: overlay) */
export const ovImage = (o: Overlay) => {
  const v = ovProp(o, 'overlay');
  return v ? unquote(v) : '';
};

/**
 * Detect pixel (non-normalized) coordinates: normalized=true present → false,
 * otherwise any extent clearly above 1 means pixel space.
 */
export function isPixelSpace(o: Overlay): boolean {
  if (ovProp(o, 'normalized').toLowerCase() === 'true') return false;
  return o.descs.some((d) => d.x > 1.5 || d.y > 1.5 || d.w > 1.5 || d.h > 1.5);
}

/** infer pixel canvas size from extents (fallback when no reference image) */
export function inferSize(o: Overlay): [number, number] {
  let x = 0, y = 0;
  for (const d of o.descs) {
    x = Math.max(x, d.x + d.w, d.x - d.w);
    y = Math.max(y, d.y + d.h, d.y - d.h);
  }
  return [Math.max(x, 1), Math.max(y, 1)];
}

/** convert one overlay from pixel space to normalized 0..1 */
export function normalizeOverlay(o: Overlay, W: number, H: number) {
  for (const d of o.descs) {
    d.x = +(d.x / W).toFixed(5);
    d.y = +(d.y / H).toFixed(5);
    d.w = +(d.w / W).toFixed(5);
    d.h = +(d.h / H).toFixed(5);
  }
  // rewrite rect prop (pixel-space rect) if present
  const rect = ovProp(o, 'rect');
  if (rect) {
    const parts = rect.split(',').map((v) => parseFloat(v));
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      setOvProp(o, 'rect', [parts[0] / W, parts[1] / H, parts[2] / W, parts[3] / H].map((v) => v.toFixed(5)).join(','));
    }
  }
  setOvProp(o, 'normalized', 'true');
}

/* ---------- categories & input catalog ---------- */

export type InputKind = 'game' | 'system' | 'menu' | 'analog' | 'keyboard' | 'lightgun' | 'area' | 'label' | 'none';

export function inputKind(name: string): InputKind {
  if (name === 'nul' || name === 'null') return 'none';
  if (/^retrok/.test(name)) return 'keyboard';
  if (/^gun_/.test(name)) return 'lightgun';
  if (/_area$/.test(name)) return 'area';
  if (/^analog_/.test(name) || /^[lr]_[xy]_(plus|minus)$/.test(name)) return 'analog';
  if (/^(overlay_next|menu|osk_toggle)/.test(name)) return 'menu';
  if (
    /^(save_state|load_state|state_slot_|rewind|hold_|pause_toggle|frame_advance|reset|screenshot|fps_toggle|toggle_fast_forward|toggle_fast_foward|fast_forward|slowmotion|toggle_slowmotion|hold_slowmotion|mute|volume_|exit_emulator|shader_|netplay_|run_ahead_toggle|cheat_|movie_record|playreplay|turbo_|ai_service)/.test(
      name,
    )
  )
    return 'system';
  if (/^(BEZEL|SCREEN|TOP_|BOTTOM_|LEFT_|RIGHT_|CENTER_|^[0-9][A-Z_]*$)/.test(name)) return 'label';
  return 'game';
}

export function isCombo(name: string) {
  return name.includes('|');
}

export const COLOR: Record<InputKind, string> = {
  game: '#2dd4bf', // teal-400
  system: '#fbbf24', // amber-400
  menu: '#a1a1aa', // zinc-400
  analog: '#c084fc', // purple-400
  keyboard: '#60a5fa', // blue-400
  lightgun: '#fb7185', // rose-400
  area: '#64748b', // slate-500
  label: '#94a3b8', // slate-400
  none: '#52525b',
};

const RETROK_LETTERS = [
  'retrok_a', 'retrok_b', 'retrok_c', 'retrok_d', 'retrok_e', 'retrok_f', 'retrok_g', 'retrok_h', 'retrok_i', 'retrok_j',
  'retrok_k', 'retrok_l', 'retrok_m', 'retrok_n', 'retrok_o', 'retrok_p', 'retrok_q', 'retrok_r', 'retrok_s', 'retrok_t',
  'retrok_u', 'retrok_v', 'retrok_w', 'retrok_x', 'retrok_y', 'retrok_z',
];

const RETROK_SPECIAL = [
  'retrok_0', 'retrok_1', 'retrok_2', 'retrok_3', 'retrok_4', 'retrok_5', 'retrok_6', 'retrok_7', 'retrok_8', 'retrok_9',
  'retrok_num0', 'retrok_num1', 'retrok_num2', 'retrok_num3', 'retrok_num4', 'retrok_num5', 'retrok_num6', 'retrok_num7',
  'retrok_num8', 'retrok_num9',
  'retrok_f1', 'retrok_f2', 'retrok_f3', 'retrok_f4', 'retrok_f5', 'retrok_f6', 'retrok_f7', 'retrok_f8', 'retrok_f9',
  'retrok_f10', 'retrok_f11', 'retrok_f12',
  'retrok_up', 'retrok_down', 'retrok_left', 'retrok_right',
  'retrok_enter', 'retrok_return', 'retrok_kp_enter', 'retrok_escape', 'retrok_tab', 'retrok_backspace', 'retrok_del',
  'retrok_delete', 'retrok_insert', 'retrok_home', 'retrok_end', 'retrok_pageup', 'retrok_pagedown',
  'retrok_space', 'retrok_backquote', 'retrok_minus', 'retrok_equals', 'retrok_leftbracket', 'retrok_rightbracket',
  'retrok_backslash', 'retrok_semicolon', 'retrok_quote', 'retrok_comma', 'retrok_period', 'retrok_slash',
  'retrok_exclaim', 'retrok_question', 'retrok_colon', 'retrok_tilde', 'retrok_divide', 'retrok_multiply', 'retrok_kp_plus',
  'retrok_kp_minus', 'retrok_kp_period', 'retrok_kp_equals',
  'retrok_lshift', 'retrok_rshift', 'retrok_shift', 'retrok_lctrl', 'retrok_rctrl', 'retrok_ctrl', 'retrok_lalt',
  'retrok_ralt', 'retrok_alt', 'retrok_capslock', 'retrok_numlock', 'retrok_scroll_lock', 'retrok_pause',
  'retrok_print_screen',
];

/**
 * Full command catalog for the input picker. Everything below is either part of
 * the RetroArch input namespace or was found in official libretro overlay
 * presets (scanned from the bundled /presets library).
 */
export const BUTTONS: { group: string; items: string[] }[] = [
  {
    group: 'Gamepad',
    items: ['a', 'b', 'x', 'y', 'start', 'select', 'l', 'r', 'l2', 'r2', 'l3', 'r3', 'up', 'down', 'left', 'right'],
  },
  {
    group: 'Combos',
    items: [
      // dpad diagonals
      'up|left', 'up|right', 'down|left', 'down|right', 'left|up', 'left|down', 'right|up', 'right|down',
      // face combos
      'a|b', 'b|a', 'a|x', 'a|y', 'b|x', 'b|y', 'x|a', 'x|b', 'x|y', 'x|l', 'x|r', 'y|a', 'y|b', 'y|l', 'y|r', 'y|x',
      'a|b|x|y', 'l|r',
      // face + dpad (used by several official presets)
      'a|left', 'a|right', 'b|left', 'b|right', 'x|left', 'x|right', 'y|left', 'y|right',
      // shoulder / trigger combos
      'l|b', 'l|x', 'l|l2', 'l|r2', 'r|a', 'r|l2', 'r|r2', 'l2|r2', 'l2|overlay_next',
      'r2|a', 'r2|b', 'r2|x', 'r2|y', 'r2|a|b', 'r2|x|a', 'r2|x|y', 'r2|y|b', 'r2|l2', 'r2|l3', 'r2|r3',
      'r3|l2', 'r3|l3', 'l|l2|r|r2', 'r|r2|r3|l|l2|l3',
      // dpad + analog stick combos (used by N64 / dual-shock presets)
      'up|l_y_minus', 'down|l_y_plus', 'left|l_x_minus', 'right|l_x_plus',
    ],
  },
  {
    group: 'Analog',
    items: ['analog_left', 'analog_right', 'l_x_plus', 'l_x_minus', 'l_y_plus', 'l_y_minus', 'r_x_plus', 'r_x_minus', 'r_y_plus', 'r_y_minus'],
  },
  {
    group: 'RetroArch (system)',
    items: [
      'menu_toggle', 'menu', 'overlay_next', 'osk_toggle',
      'save_state', 'load_state', 'state_slot_increase', 'state_slot_decrease',
      'rewind', 'hold_rewind', 'pause_toggle', 'frame_advance', 'reset', 'screenshot', 'fps_toggle',
      'toggle_fast_forward', 'hold_fast_forward', 'toggle_fast_foward', 'fast_forward',
      'toggle_slowmotion', 'hold_slowmotion', 'slowmotion', 'mute', 'volume_up', 'volume_down',
      'exit_emulator', 'shader_prev', 'shader_next', 'hold_enable', 'turbo_enable',
      'netplay_ping', 'netplay_player_chat', 'run_ahead_toggle', 'ai_service',
      'movie_record', 'movie_play', 'cheat_index_plus', 'cheat_index_minus', 'cheat_toggle',
    ],
  },
  {
    group: 'Light gun',
    items: ['gun_trigger', 'gun_offscreen_shot', 'gun_aux_a', 'gun_aux_b', 'gun_aux_c', 'gun_start', 'gun_select', 'gun_dpad_up', 'gun_dpad_down', 'gun_dpad_left', 'gun_dpad_right'],
  },
  {
    group: 'Keyboard — letters',
    items: RETROK_LETTERS,
  },
  {
    group: 'Keyboard — numbers, F-keys, navigation',
    items: RETROK_SPECIAL,
  },
  {
    group: 'Keyboard modifiers (combine with |)',
    items: ['retrokmod_ctrl', 'retrokmod_shift', 'retrokmod_alt', 'retrokmod_gui', 'retrokmod_ctrl|retrok_a', 'retrokmod_ctrl|retrok_c', 'retrokmod_ctrl|retrok_v', 'retrokmod_ctrl|retrok_x', 'retrokmod_shift|retrok_escape', 'retrokmod_ctrl|retrok_q'],
  },
  {
    group: 'Areas & special',
    items: ['dpad_area', 'abxy_area', 'nul', 'null'],
  },
  {
    group: 'Decorative labels (official presets)',
    items: ['BEZEL_LEFT', 'BEZEL_RIGHT', 'TOP_CENTER', 'BOTTOM_CENTER', '0_LEFT', '0_RIGHT', '6button_bg'],
  },
];

export const DESC_NAME_RE = /^[A-Za-z0-9_|+\-.:]*$/;

export function sanitizeDescName(s: string) {
  const v = s.replace(/[\s,;"']/g, '');
  return DESC_NAME_RE.test(v) ? v : '';
}

/* ---------- path helpers ---------- */

export function resolveImgRef(cfgDir: string, ref: string): string {
  const clean = ref.replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = (cfgDir ? cfgDir.split('/') : []).concat(clean.split('/'));
  const st: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') st.pop();
    else st.push(p);
  }
  return st.join('/');
}

export const basename = (p: string) => p.split('/').pop() ?? p;

/* ---------- geometry ---------- */

/** Point-in-hitbox test using effective range_mod (the fixed model). */
export function hitTest(
  o: Overlay,
  d: Desc,
  nx: number,
  ny: number,
): boolean {
  if (d.name === 'nul' || d.name === 'null') return false;
  const rm = effectiveRangeMod(o, d);
  const w = d.w * rm;
  const h = d.h * rm;
  if (w <= 0 || h <= 0) return false;
  const dx = Math.abs(nx - d.x);
  const dy = Math.abs(ny - d.y);
  return d.shape === 'rect' ? dx <= w && dy <= h : (dx / w) ** 2 + (dy / h) ** 2 <= 1;
}
