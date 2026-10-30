#!/usr/bin/env python3
"""Landscape hotkey fix for the user's Game Boy preset (and any Custom cfg):

The user's original file had save_state on BOTH sides of the landscape pages.
Matching the portrait pages (save left / load right), every save_state desc
with x > 0.5 becomes load_state and its icon becomes hotkey_load_state.png.
Idempotent; only touches lines, geometry stays identical.
"""
import re
import sys

FILES = sys.argv[1:] or ['/home/z/my-project/public/presets/Custom/Nintendo - Game Boy.cfg']

for path in FILES:
    text = open(path).read()
    out = []
    pending_img = False
    changed = 0
    for line in text.splitlines():
        m = re.match(r'^(\s*overlay\d+_desc\d+\s*=\s*")save_state,([0-9.]+)(.*)$', line)
        if m and float(m.group(2)) > 0.5:
            line = f'{m.group(1)}load_state,{m.group(2)}{m.group(3)}'
            changed += 1
            pending_img = True
        elif pending_img and '_overlay' in line and 'hotkey_save_state.png' in line:
            line = line.replace('hotkey_save_state.png', 'hotkey_load_state.png')
            pending_img = False
        out.append(line)
    open(path, 'w').write('\n'.join(out) + '\n')
    print(f'{path.split("/")[-1]}: {changed} save_state -> load_state')
