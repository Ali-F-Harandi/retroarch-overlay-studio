#!/usr/bin/env python3
"""Move the 5 custom console presets from gamepads/flat into a dedicated,
self-contained Custom/ folder (cfgs + their images + thumbnails), and update
public/presets/index.json with a new top-level "Custom" category.

The Game Boy preset is the user's own file: after the move we assert that its
layout data is byte-identical to upload/Nintendo - Game Boy.cfg and that ONLY
the image path prefix changed (../flat/img/ -> img/), which is unavoidable
when the file changes directory.
"""
import datetime
import json
import os
import re
import shutil
import sys

ROOT = '/home/z/my-project'
PRESETS = os.path.join(ROOT, 'public/presets')
FLAT = os.path.join(PRESETS, 'gamepads/flat')
CUSTOM = os.path.join(PRESETS, 'Custom')
THUMB_FLAT = os.path.join(PRESETS, '.thumbs/gamepads/flat')
THUMB_CUSTOM = os.path.join(PRESETS, '.thumbs/Custom')
GB_UPLOAD = os.path.join(ROOT, 'upload/Nintendo - Game Boy.cfg')

FILES = [
    'Nintendo - Game Boy.cfg',
    'Nintendo - Game Boy Advance.cfg',
    'Nintendo - NES.cfg',
    'Sega - Genesis.cfg',
    'Nintendo - SNES.cfg',
]

# _overlay = ../flat/img/foo.png   or   _overlay = "../flat/img/foo.png"
img_re = re.compile(r'(_overlay\s*=\s*"?)\.\./flat/img/([^"]*?)("?\s*)$')

fails = 0

os.makedirs(os.path.join(CUSTOM, 'img'), exist_ok=True)
os.makedirs(THUMB_CUSTOM, exist_ok=True)

copied_images = set()
for fn in FILES:
    src = os.path.join(FLAT, fn)
    if not os.path.exists(src):
        print(f'FAIL missing source cfg: {src}')
        fails += 1
        continue
    text = open(src).read()
    out_lines = []
    for line in text.splitlines():
        m = img_re.search(line)
        if m:
            copied_images.add(m.group(2))
            line = img_re.sub(lambda mm: f'{mm.group(1)}img/{mm.group(2)}{mm.group(3)}', line)
        out_lines.append(line)
    out = '\n'.join(out_lines) + ('\n' if text.endswith('\n') else '')
    if '../flat/img/' in out or 'flat/img' in out:
        print(f'FAIL {fn}: unresolved flat/img reference left behind')
        fails += 1
    with open(os.path.join(CUSTOM, fn), 'w') as f:
        f.write(out)
    os.remove(src)
    print(f'moved {fn} -> Custom/ ({len(copied_images)} unique images so far)')

for img in sorted(copied_images):
    src = os.path.join(FLAT, 'img', img)
    if not os.path.exists(src):
        print(f'FAIL missing image: {src}')
        fails += 1
        continue
    shutil.copy2(src, os.path.join(CUSTOM, 'img', img))
print(f'copied {len(copied_images)} images into Custom/img/')

for fn in FILES:
    t = os.path.join(THUMB_FLAT, fn[:-4] + '.png')
    if os.path.exists(t):
        shutil.move(t, os.path.join(THUMB_CUSTOM, fn[:-4] + '.png'))
    else:
        print(f'WARN thumb not found: {t}')

# ---- Game Boy fidelity check: identical to the user's upload except paths ----
def norm(p):
    return open(p).read().replace('../flat/img/', 'img/')

if os.path.exists(GB_UPLOAD) and os.path.exists(os.path.join(CUSTOM, FILES[0])):
    if norm(GB_UPLOAD) == norm(os.path.join(CUSTOM, FILES[0])):
        print('GB check OK: layout identical to the user\'s file (path prefix only)')
    else:
        print('FAIL GB file differs from the user\'s upload beyond image paths')
        fails += 1

# ---- index.json ----
idx_path = os.path.join(PRESETS, 'index.json')
idx = json.load(open(idx_path))
custom_cfgs = []
for cat in idx['categories']:
    if cat['id'] != 'gamepads':
        continue
    keep = []
    for c in cat['cfgs']:
        if c.get('dir') == 'gamepads/flat' and c['file'] in FILES:
            custom_cfgs.append({
                'name': c['name'],
                'file': c['file'],
                'path': 'Custom/' + c['file'],
                'dir': 'Custom',
                'overlays': c['overlays'],
                'descs': c['descs'],
                'names': c['names'],
                'thumb': '.thumbs/Custom/' + c['file'][:-4] + '.png',
            })
        else:
            keep.append(c)
    cat['cfgs'] = keep
    cat['count'] = len(keep)
if custom_cfgs:
    custom_cfgs.sort(key=lambda c: FILES.index(c['file']))
    idx['categories'].insert(0, {'id': 'Custom', 'count': len(custom_cfgs), 'cfgs': custom_cfgs})
idx['generated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open(idx_path, 'w') as f:
    json.dump(idx, f, indent=1, ensure_ascii=False)
    f.write('\n')

total = sum(c['count'] for c in idx['categories'])
print(f'index.json updated: Custom={len(custom_cfgs)} (first category), total={total}')
sys.exit(1 if fails else 0)
