#!/usr/bin/env python3
"""
Generate the user's custom console overlay presets (landscape + portrait,
A/B size variants) matching the design of their "Nintendo - Game Boy.cfg":

  - 6 overlay pages: landscape-A, hidden-A, portrait-A, landscape-B, hidden-B, portrait-B
  - range_mod 1.5 / alpha_mod 2.0 / full_screen / normalized
  - user's hotkey set: menu, fast-forward, quick save (x2 landscape; save+load,
    rewind, slow-motion in portrait), variant switch, hide, rotate relay
  - console-specific controls taken from the official libretro "flat" layouts
  - images resolve via ../flat/img/* (cfgs live in gamepads/flat/)

Output: public/presets/gamepads/flat/<name>.cfg
"""
import math
import os
import shutil

ROOT = '/home/z/my-project/public/presets/gamepads/flat'
UPLOAD_GB = '/home/z/my-project/upload/Nintendo - Game Boy.cfg'

# ---------------------------------------------------------------- primitives
# entry: (cmd, x, y, shape, w, h, img, next_target)   img/target may be None
# tag controls whether the B variant scales the hitbox (True) or keeps size (False)

DPAD_LAND = [
    ('left',      0.07188, 0.77778, 'radial', 0.05364, 0.08148, 'dpad-left.png'),
    ('right',     0.19896, 0.77778, 'radial', 0.05364, 0.08148, 'dpad-right.png'),
    ('up',        0.13542, 0.66481, 'radial', 0.04583, 0.09537, 'dpad-up.png'),
    ('down',      0.13542, 0.89074, 'radial', 0.04583, 0.09537, 'dpad-down.png'),
    ('left|up',   0.05313, 0.63148, 'rect',   0.03646, 0.06481, None),
    ('right|up',  0.21771, 0.63148, 'rect',   0.03646, 0.06481, None),
    ('left|down', 0.05313, 0.92407, 'rect',   0.03646, 0.06481, None),
    ('right|down',0.21771, 0.92407, 'rect',   0.03646, 0.06481, None),
]

DPAD_PORT = [
    ('left',      0.13218, 0.65622, 'radial', 0.10111, 0.04867, 'dpad-left.png'),
    ('right',     0.36939, 0.65622, 'radial', 0.10111, 0.04867, 'dpad-right.png'),
    ('up',        0.25079, 0.58951, 'radial', 0.08653, 0.05688, 'dpad-up.png'),
    ('down',      0.25079, 0.72294, 'radial', 0.08653, 0.05688, 'dpad-down.png'),
    ('left|up',   0.09523, 0.56982, 'rect',   0.06805, 0.03828, None),
    ('right|up',  0.40440, 0.56982, 'rect',   0.06805, 0.03828, None),
    ('left|down', 0.09523, 0.74372, 'rect',   0.06805, 0.03828, None),
    ('right|down',0.40440, 0.74372, 'rect',   0.06805, 0.03828, None),
]

def sys_land(switch_img, rotate_target, hide_target, switch_target):
    return [
        ('menu_toggle',        0.2, 0.1, 'radial', 0.02604, 0.0463, 'rgui.png', None, False),
        ('overlay_next',       2.65, 2.08889, 'radial', 0.02604, 0.0463, 'rotate.png', rotate_target, False),
        ('overlay_next',       0.9, 0.1, 'radial', 0.02604, 0.0463, 'hide.png', hide_target, False),
        ('overlay_next',       0.1, 0.1, 'radial', 0.02604, 0.0463, switch_img, switch_target, False),
        ('toggle_fast_forward',0.8, 0.1, 'radial', 0.02604, 0.0463, 'fast_forward.png', None, False),
        ('save_state',         0.2, 0.3, 'radial', 0.02508, 0.04459, 'hotkey_save_state.png', None, False),
        ('save_state',         0.8, 0.3, 'radial', 0.02508, 0.04459, 'hotkey_save_state.png', None, False),
    ]

def sys_port(switch_img, rotate_target, switch_target):
    return [
        ('menu_toggle',        0.5, 0.45, 'radial', 0.0463, 0.02604, 'rgui.png', None, False),
        ('overlay_next',       2.65, 2.94792, 'radial', 0.0463, 0.02604, 'rotate.png', rotate_target, False),
        ('overlay_next',       0.15, 0.9, 'radial', 0.0463, 0.02604, switch_img, switch_target, False),
        ('toggle_fast_forward',0.85, 0.9, 'radial', 0.0463, 0.02604, 'fast_forward.png', None, False),
        ('load_state',         0.75, 0.45, 'radial', 0.0459, 0.02582, 'hotkey_load_state.png', None, False),
        ('save_state',         0.25, 0.45, 'radial', 0.04511, 0.02537, 'hotkey_save_state.png', None, False),
        ('rewind',             0.35, 0.95, 'radial', 0.04572, 0.02572, 'hotkey_rewind.png', None, False),
        ('toggle_slowmotion',  0.65, 0.95, 'radial', 0.04674, 0.02629, 'hotkey_toggle_slowmotion.png', None, False),
    ]

def entry(cmd, x, y, shape, w, h, img=None, scalable=True):
    return (cmd, x, y, shape, w, h, img, None, scalable)

def combo_pair(cmd, a, b, focal, w, h):
    """two small combo hitboxes between buttons a and b, nudged toward focal"""
    out = []
    for t in (0.42, 0.58):
        px = a[0] + (b[0] - a[0]) * t
        py = a[1] + (b[1] - a[1]) * t
        dx, dy = focal[0] - px, focal[1] - py
        n = math.hypot(dx, dy) or 1.0
        out.append(entry(cmd, px + dx / n * 0.015, py + dy / n * 0.015, 'radial', w, h, None))
    return out

# ---------------------------------------------------------------- consoles

GBA_LAND = [
    entry('a', 0.91667, 0.77778, 'radial', 0.05, 0.08889, 'A.png'),
    entry('b', 0.80833, 0.85185, 'radial', 0.05, 0.08889, 'B.png'),
    entry('a|b', 0.85833, 0.79555, 'radial', 0.01667, 0.02963),
    entry('a|b', 0.86667, 0.83408, 'radial', 0.01667, 0.02963),
    entry('l', 0.02917, 0.41852, 'rect', 0.05208, 0.09259, 'L.png'),
    entry('r', 0.97083, 0.55556, 'rect', 0.05208, 0.09259, 'R.png'),
    entry('l|r', 0.54896, 0.94815, 'rect', 0.05416, 0.09259, None),
    entry('start', 0.9375, 0.26, 'radial', 0.03958, 0.07037, 'start.png'),
    entry('select', 0.0625, 0.22, 'radial', 0.03958, 0.07037, 'start.png'),
]

GBA_PORT = [
    entry('a', 0.87888, 0.65521, 'radial', 0.09333, 0.0525, 'A.png'),
    entry('b', 0.67667, 0.69896, 'radial', 0.09333, 0.0525, 'B.png'),
    entry('a|b', 0.77037, 0.66625, 'radial', 0.02963, 0.01667),
    entry('a|b', 0.78518, 0.68792, 'radial', 0.02963, 0.01667),
    entry('l', 0.04815, 0.45416, 'rect', 0.09259, 0.05208, 'L.png'),
    entry('l', 0.95185, 0.41875, 'rect', 0.09259, 0.05208, 'L.png'),
    entry('r', 0.95185, 0.53125, 'rect', 0.09259, 0.05208, 'R.png'),
    entry('l|r', 0.90741, 0.475, 'rect', 0.02963, 0.01667, None),
    entry('l|r', 0.96667, 0.475, 'rect', 0.02963, 0.01667, None),
    entry('start', 0.62037, 0.83386, 'radial', 0.07037, 0.03958, 'start.png'),
    entry('select', 0.37963, 0.83386, 'radial', 0.07037, 0.03958, 'start.png'),
]

NES_LAND = [
    entry('a', 0.91667, 0.85185, 'radial', 0.05, 0.08889, 'A.png'),
    entry('b', 0.80208, 0.85185, 'radial', 0.05, 0.08889, 'B.png'),
    entry('a|b', 0.85938, 0.83333, 'radial', 0.01667, 0.02963),
    entry('a|b', 0.85938, 0.87037, 'radial', 0.01667, 0.02963),
    entry('start', 0.63958, 0.9, 'radial', 0.04583, 0.03889, 'start.png'),
    entry('select', 0.36042, 0.9, 'radial', 0.04583, 0.03889, 'start.png'),
]

NES_PORT = [
    entry('a', 0.87407, 0.71875, 'radial', 0.08889, 0.05, 'A.png'),
    entry('b', 0.68148, 0.71875, 'radial', 0.08889, 0.05, 'B.png'),
    entry('a|b', 0.77778, 0.70833, 'radial', 0.02963, 0.01667),
    entry('a|b', 0.77778, 0.72917, 'radial', 0.02963, 0.01667),
    entry('start', 0.88889, 0.58854, 'radial', 0.08148, 0.021875, 'start.png'),
    entry('select', 0.11111, 0.46354, 'radial', 0.08148, 0.021875, 'start.png'),
]

# RetroArch Mega Drive mapping: retropad y = pad A, b = pad B, a = pad C
GEN_LAND = [
    entry('y', 0.75, 0.89074, 'radial', 0.05, 0.08889, 'A.png'),
    entry('b', 0.83958, 0.8, 'radial', 0.05, 0.08889, 'B.png'),
    entry('a', 0.9375, 0.75, 'radial', 0.05, 0.08889, 'C.png'),
    entry('y|b', 0.78854, 0.82587, 'radial', 0.01667, 0.02963),
    entry('y|b', 0.80104, 0.86487, 'radial', 0.01667, 0.02963),
    entry('b|a', 0.8851, 0.75372, 'radial', 0.01667, 0.02963),
    entry('b|a', 0.89198, 0.79628, 'radial', 0.01667, 0.02963),
    entry('start', 0.93958, 0.51852, 'rect', 0.04583, 0.03889, 'start_genesis.png'),
]

_GY, _GB, _GA = (0.6, 0.7), (0.76, 0.65), (0.9, 0.58)
_GMID = (0.7533, 0.6433)
GEN_PORT = [
    entry('y', *_GY, 'radial', 0.08889, 0.05, 'A.png'),
    entry('b', *_GB, 'radial', 0.08889, 0.05, 'B.png'),
    entry('a', *_GA, 'radial', 0.08889, 0.05, 'C.png'),
    *combo_pair('y|b', _GY, _GB, _GMID, 0.02963, 0.01667),
    *combo_pair('b|a', _GB, _GA, _GMID, 0.02963, 0.01667),
    entry('start', 0.62, 0.83386, 'radial', 0.07037, 0.03958, 'start_genesis.png'),
]

SNES_LAND = [
    entry('a', 0.91979, 0.72407, 'radial', 0.05, 0.08889, 'A.png'),
    entry('b', 0.84479, 0.85741, 'radial', 0.05, 0.08889, 'B.png'),
    entry('x', 0.84479, 0.59074, 'radial', 0.05, 0.08889, 'X.png'),
    entry('y', 0.76979, 0.72407, 'radial', 0.05, 0.08889, 'Y.png'),
    entry('x|y', 0.8, 0.64444, 'radial', 0.01667, 0.02963),
    entry('x|y', 0.81458, 0.67037, 'radial', 0.01667, 0.02963),
    entry('a|b', 0.875, 0.77777, 'radial', 0.01667, 0.02963),
    entry('a|b', 0.88958, 0.8037, 'radial', 0.01667, 0.02963),
    entry('y|b', 0.8, 0.8037, 'radial', 0.01667, 0.02963),
    entry('y|b', 0.81458, 0.77778, 'radial', 0.01667, 0.02963),
    entry('x|a', 0.875, 0.67037, 'radial', 0.01667, 0.02963),
    entry('x|a', 0.88958, 0.64444, 'radial', 0.01667, 0.02963),
    entry('l', 0.02917, 0.44074, 'rect', 0.05208, 0.09259, 'L.png'),
    entry('r', 0.97083, 0.5, 'rect', 0.05208, 0.09259, 'R.png'),
    entry('l|r', 0.58438, 0.94815, 'rect', 0.05416, 0.09259, None),
    entry('start', 0.9375, 0.25, 'rect', 0.03958, 0.07037, 'start.png'),
    entry('select', 0.0625, 0.23, 'rect', 0.03958, 0.07037, 'start.png'),
]

_SX, _SY, _SA, _SB = (0.87, 0.6), (0.79, 0.665), (0.95, 0.665), (0.87, 0.73)
_SMID = (0.87, 0.665)
SNES_PORT = [
    entry('x', *_SX, 'radial', 0.065, 0.0367, 'X.png'),
    entry('y', *_SY, 'radial', 0.065, 0.0367, 'Y.png'),
    entry('a', *_SA, 'radial', 0.065, 0.0367, 'A.png'),
    entry('b', *_SB, 'radial', 0.065, 0.0367, 'B.png'),
    *combo_pair('x|y', _SX, _SY, _SMID, 0.02469, 0.01389),
    *combo_pair('a|b', _SA, _SB, _SMID, 0.02469, 0.01389),
    *combo_pair('y|b', _SY, _SB, _SMID, 0.02469, 0.01389),
    *combo_pair('x|a', _SX, _SA, _SMID, 0.02469, 0.01389),
    entry('l', 0.04815, 0.45416, 'rect', 0.09259, 0.05208, 'L.png'),
    entry('r', 0.95185, 0.45416, 'rect', 0.09259, 0.05208, 'R.png'),
    entry('start', 0.62037, 0.83386, 'radial', 0.07037, 0.03958, 'start.png'),
    entry('select', 0.37963, 0.83386, 'radial', 0.07037, 0.03958, 'start.png'),
]

CONSOLES = [
    ('Nintendo - Game Boy Advance.cfg', GBA_LAND, GBA_PORT),
    ('Nintendo - NES.cfg', NES_LAND, NES_PORT),
    ('Sega - Genesis.cfg', GEN_LAND, GEN_PORT),
    ('Nintendo - SNES.cfg', SNES_LAND, SNES_PORT),
]

SCALE_B = 0.833  # B variants keep centers, shrink hitboxes (like the user's GB preset)

# ---------------------------------------------------------------- emitter

def fmt(v):
    return f'{v:.5f}'

def emit_desc(ov, i, e, scale):
    cmd, x, y, shape, w, h, img, target, scalable = e
    sw, sh = (w * scale, h * scale) if (scale != 1.0 and scalable) else (w, h)
    lines = [f'overlay{ov}_desc{i} = "{cmd},{fmt(x)},{fmt(y)},{shape},{fmt(sw)},{fmt(sh)}"']
    if img:
        lines.append(f'overlay{ov}_desc{i}_overlay = ../flat/img/{img}')
    if target:
        lines.append(f'overlay{ov}_desc{i}_next_target = "{target}"')
    return lines

def emit_overlay(ov, name, controls, system, scale=1.0, switch_img=None):
    out = [
        f'overlay{ov}_full_screen = true',
        f'overlay{ov}_normalized = true',
        f'overlay{ov}_name = "{name}"',
        f'overlay{ov}_range_mod = 1.5',
        f'overlay{ov}_alpha_mod = 2.0',
        '',
    ]
    descs = [(*e, None, True) if len(e) == 7 else e for e in controls] + system
    out.append(f'overlay{ov}_descs = {len(descs)}')
    out.append('')
    for i, e in enumerate(descs):
        out.extend(emit_desc(ov, i, e, scale))
    return out

def build_cfg(land, port):
    lines = ['overlays = 6', '']
    # overlay0 landscape-A
    lines += emit_overlay(0, 'landscape-A', DPAD_LAND + land,
                          sys_land('overlay-A.png', 'portrait-A', 'hidden-A', 'landscape-B'))
    # overlay1 hidden-A
    lines += emit_overlay(1, 'hidden-A', [],
                          [('overlay_next', 0.8, 0.08889, 'radial', 0.02604, 0.0463, 'show.png', 'landscape-A', False)])
    # overlay2 portrait-A
    lines += emit_overlay(2, 'portrait-A', DPAD_PORT + port,
                          sys_port('overlay-A.png', 'landscape-A', 'portrait-B'))
    # overlay3 landscape-B
    lines += emit_overlay(3, 'landscape-B', DPAD_LAND + land,
                          sys_land('overlay-B.png', 'portrait-B', 'hidden-B', 'landscape-A'), scale=SCALE_B)
    # overlay4 hidden-B
    lines += emit_overlay(4, 'hidden-B', [],
                          [('overlay_next', 0.8, 0.08889, 'radial', 0.02604, 0.0463, 'show.png', 'landscape-B', False)])
    # overlay5 portrait-B
    lines += emit_overlay(5, 'portrait-B', DPAD_PORT + port,
                          sys_port('overlay-B.png', 'landscape-B', 'portrait-A'), scale=SCALE_B)
    return '\n'.join(lines) + '\n'

def main():
    # 1. the user's Game Boy / Color preset, copied verbatim
    dst_gb = os.path.join(ROOT, 'Nintendo - Game Boy.cfg')
    shutil.copyfile(UPLOAD_GB, dst_gb)
    print('copied', dst_gb)

    # 2. generated consoles
    for name, land, port in CONSOLES:
        text = build_cfg(land, port)
        path = os.path.join(ROOT, name)
        with open(path, 'w') as f:
            f.write(text)
        n_desc = text.count('_desc') // 2  # rough; print real counts instead
        counts = []
        for ov in range(6):
            c = sum(1 for ln in text.splitlines() if ln.startswith(f'overlay{ov}_desc') and ln.endswith('"'))
            counts.append(c)
        print(f'wrote {path}  descs per overlay: {counts}')

if __name__ == '__main__':
    main()
