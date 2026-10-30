#!/usr/bin/env python3
"""Add FBNeo - Arcade and Sony - PlayStation to the Custom category of
public/presets/index.json (idempotent, entries appended after SNES)."""
import datetime
import json
import os
import re

PRESETS = '/home/z/my-project/public/presets'
NEW = ['FBNeo - Arcade.cfg', 'Sony - PlayStation.cfg']

name_re = re.compile(r'^overlay(\d+)_name\s*=\s*"?([^"\n]+)"?')
descs_re = re.compile(r'^overlay(\d+)_descs\s*=\s*(\d+)')

idx_path = os.path.join(PRESETS, 'index.json')
idx = json.load(open(idx_path))
custom = next((c for c in idx['categories'] if c['id'] == 'Custom'), None)
if custom is None:
    raise SystemExit('Custom category missing')

existing = {c['file'] for c in custom['cfgs']}
for fn in NEW:
    if fn in existing:
        print('skip (exists):', fn)
        continue
    text = open(os.path.join(PRESETS, 'Custom', fn)).read()
    names, descs = [], 0
    for line in text.splitlines():
        m = name_re.match(line.strip())
        if m:
            names.append(m.group(2))
            continue
        m = descs_re.match(line.strip())
        if m:
            descs += int(m.group(2))
    custom['cfgs'].append({
        'name': fn[:-4],
        'file': fn,
        'path': 'Custom/' + fn,
        'dir': 'Custom',
        'overlays': len(names),
        'descs': descs,
        'names': names,
        'thumb': '.thumbs/Custom/' + fn[:-4] + '.png',
    })
    print('added:', fn, f'({len(names)} overlays, {descs} descs)')

custom['count'] = len(custom['cfgs'])
idx['generated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open(idx_path, 'w') as f:
    json.dump(idx, f, indent=1, ensure_ascii=False)
    f.write('\n')
print('Custom count:', custom['count'], '| total:', sum(c['count'] for c in idx['categories']))
