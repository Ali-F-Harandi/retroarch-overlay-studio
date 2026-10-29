#!/usr/bin/env python3
"""Scan official overlay cfgs: collect desc names, extra keys, prop keys, shapes, image refs."""
import re, json, os, collections

ROOT = '/tmp/overlays_extract'
desc_re = re.compile(r'^overlay(\d+)_desc(\d+)\s*=\s*"(.*)"\s*$')
prop_re = re.compile(r'^overlay(\d+)_(\w+)\s*=\s*(.*)$')
dx_re = re.compile(r'^overlay(\d+)_desc(\d+)_(\w+)\s*=\s*(.*)$')

names = collections.Counter()
shapes = collections.Counter()
dx_keys = collections.Counter()
prop_keys = collections.Counter()
img_refs = collections.Counter()
field_counts = collections.Counter()
files = 0
parse_fail = []

for dirpath, _, files_ in os.walk(ROOT):
    for fn in files_:
        if not fn.endswith('.cfg'):
            continue
        files += 1
        p = os.path.join(dirpath, fn)
        with open(p, encoding='utf-8', errors='replace') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                m = desc_re.match(line)
                if m:
                    fields = m.group(3).split(',')
                    field_counts[len(fields)] += 1
                    if len(fields) >= 6:
                        names[fields[0].strip()] += 1
                        shapes[fields[3].strip()] += 1
                    continue
                m = dx_re.match(line)
                if m:
                    dx_keys[m.group(3)] += 1
                    if m.group(3) == 'overlay':
                        img_refs[m.group(4)] += 1
                    continue
                m = prop_re.match(line)
                if m:
                    prop_keys[m.group(2)] += 1

print(f"cfg files: {files}")
print("\n== desc name (input) ==")
for k, v in names.most_common(60):
    print(f"  {v:6d}  {k}")
print("\n== shapes ==", dict(shapes))
print("\n== desc extra keys ==")
for k, v in dx_keys.most_common():
    print(f"  {v:6d}  {k}")
print("\n== overlay prop keys ==")
for k, v in prop_keys.most_common():
    print(f"  {v:6d}  {k}")
print("\n== desc field counts ==", dict(field_counts))
print("\n== sample img refs ==")
for k, v in list(img_refs.most_common(8)):
    print(f"  {v:5d}  {k}")
