#!/usr/bin/env python3
"""Validate the generated console presets: structure, images, targets, overlaps."""
import math, os, re, sys

ROOT = '/home/z/my-project/public/presets/Custom'
FILES = [
    'Nintendo - Game Boy.cfg',
    'Nintendo - Game Boy Advance.cfg',
    'Nintendo - NES.cfg',
    'Sega - Genesis.cfg',
    'Nintendo - SNES.cfg',
    'FBNeo - Arcade.cfg',
    'Sony - PlayStation.cfg',
]

desc_re = re.compile(r'^overlay(\d+)_desc(\d+)\s*=\s*"(.*)"')
img_re = re.compile(r'^overlay(\d+)_desc(\d+)_overlay\s*=\s*(.*)')
tgt_re = re.compile(r'^overlay(\d+)_desc(\d+)_next_target\s*=\s*"(.*)"')
name_re = re.compile(r'^overlay(\d+)_name\s*=\s*"?([^"\n]+)"?')
cnt_re = re.compile(r'^overlay(\d+)_descs\s*=\s*(\d+)')

def resolve(cfgdir, ref):
    parts = (cfgdir.split('/') if cfgdir else []) + ref.replace('\\', '/').split('/')
    st = []
    for p in parts:
        if not p or p == '.': continue
        if p == '..': st.pop()
        else: st.append(p)
    return '/'.join(st)

fails = 0
for fn in FILES:
    text = open(os.path.join(ROOT, fn)).read()
    descs, imgs, tgts, names, cnts = {}, {}, {}, {}, {}
    for line in text.splitlines():
        line = line.strip()
        m = desc_re.match(line)
        if m: descs[(int(m.group(1)), int(m.group(2)))] = m.group(3); continue
        m = img_re.match(line)
        if m: imgs[(int(m.group(1)), int(m.group(2)))] = m.group(3); continue
        m = tgt_re.match(line)
        if m: tgts[(int(m.group(1)), int(m.group(2)))] = m.group(3); continue
        m = name_re.match(line)
        if m: names[(int(m.group(1)),)] = m.group(2); continue
        m = cnt_re.match(line)
        if m: cnts[(int(m.group(1)),)] = int(m.group(2)); continue
    # 1. overlay count + declared desc counts
    ovl = int(re.search(r'^overlays\s*=\s*(\d+)', text, re.M).group(1))
    if ovl != 6: print(f'FAIL {fn}: overlays={ovl}'); fails += 1
    for (ov,), c in cnts.items():
        actual = sum(1 for k in descs if k[0] == ov)
        if actual != c: print(f'FAIL {fn}: overlay{ov} declared {c} descs, found {actual}'); fails += 1
    # 2. name uniqueness + count
    if len(names) != 6: print(f'FAIL {fn}: {len(names)} names'); fails += 1
    name_by_ov = {k[0]: v for k, v in names.items()}
    # 3. images exist
    for (ov, di), ref in imgs.items():
        rel = resolve('Custom', ref.strip().strip('"'))
        if not os.path.exists(os.path.join('/home/z/my-project/public/presets', rel)):
            print(f'FAIL {fn}: overlay{ov} desc{di} missing image {ref}'); fails += 1
    # 4. next targets resolve
    for (ov, di), tgt in tgts.items():
        if tgt not in name_by_ov.values():
            print(f'FAIL {fn}: overlay{ov} desc{di} bad target {tgt}'); fails += 1
    # 5. wiring sanity: A pages rotate to counterpart, B pages back
    for ov, nm in name_by_ov.items():
        tgs = {tgts[(ov, di)] for (o, di) in tgts if o == ov}
        if nm.startswith('landscape-A') and 'portrait-A' not in tgs: print(f'FAIL {fn}: {nm} no rotate to portrait-A'); fails += 1
    # 6. overlap report for non-combo, non-system buttons on page 0 (A landscape)
    COMBO = lambda c: '|' in c
    SYS = {'menu_toggle', 'overlay_next', 'toggle_fast_forward', 'save_state', 'load_state',
           'rewind', 'toggle_slowmotion', 'screenshot', 'pause_toggle'}
    pts = []
    for (ov, di), v in descs.items():
        if ov != 0: continue
        f = v.split(',')
        if len(f) < 6: continue
        if COMBO(f[0]) or f[0] in SYS: continue
        pts.append((f[0], float(f[1]), float(f[2]), float(f[4]), float(f[5])))
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            c1, x1, y1, w1, h1 = pts[i]; c2, x2, y2, w2, h2 = pts[j]
            if c1 == c2: continue
            d = math.hypot((x2 - x1) / (w1 + w2), (y2 - y1) / (h1 + h2))
            if d < 0.98:
                print(f'WARN {fn}: overlap {c1} <-> {c2}  d={d:.2f}')
    print(f'checked {fn}: {sum(1 for k in descs)} descs total, {len(imgs)} images, {len(tgts)} targets')

print('FAILS:' if fails else 'ALL OK', fails if fails else '')
sys.exit(1 if fails else 0)
