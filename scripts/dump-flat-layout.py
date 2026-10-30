#!/usr/bin/env python3
"""Dump per-overlay desc layouts of an official flat cfg (for reference)."""
import re
import sys

path = sys.argv[1]
want = sys.argv[2:] or None

cur = None
names = {}
descs = {}
imgs = {}

for raw in open(path).read().splitlines():
    line = raw.strip()
    m = re.match(r'^overlay(\d+)_name\s*=\s*"?([^"\n]+)"?', line)
    if m:
        names[m.group(1)] = m.group(2)
        continue
    m = re.match(r'^overlay(\d+)_desc(\d+)\s*=\s*"(.*)"', line)
    if m:
        descs[(m.group(1), m.group(2))] = m.group(3)
        continue
    m = re.match(r'^overlay(\d+)_desc(\d+)_overlay\s*=\s*"?([^"\n]+)"?', line)
    if m:
        imgs[(m.group(1), m.group(2))] = m.group(3)

for (ov, di) in sorted(descs, key=lambda k: (int(k[0]), int(k[1]))):
    label = names.get(ov, ov)
    if want and not any(w.lower() in label.lower() for w in want):
        continue
    print(f'[{label}] desc{di}: {descs[(ov, di)]}   img={imgs.get((ov, di), "-")}')
