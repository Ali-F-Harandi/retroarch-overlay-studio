#!/usr/bin/env python3
"""Scan every bundled preset .cfg and collect every unique desc input name (field 1)."""
import json, os, re, collections

ROOT = '/home/z/my-project/public/presets'
desc_re = re.compile(r'^overlay\d+_desc\d+\s*=\s*"(.*)"\s*$')
bom = '\ufeff'

cmds = collections.Counter()          # name -> usage count
per_cat = collections.defaultdict(set)
weird = []                            # names with unusual chars

for dirpath, _dirs, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith('.cfg'):
            continue
        fp = os.path.join(dirpath, fn)
        rel = os.path.relpath(fp, ROOT)
        cat = rel.split(os.sep)[0]
        try:
            text = open(fp, encoding='utf-8', errors='replace').read().lstrip(bom)
        except Exception:
            continue
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            m = desc_re.match(line)
            if not m:
                continue
            fields = m.group(1).split(',')
            name = fields[0].strip().strip('"').strip()
            if not name:
                continue
            cmds[name] += 1
            per_cat[cat].add(name)
            if re.search(r'[^A-Za-z0-9_|+\-.:]', name):
                weird.append((rel, name))

out = {
    'total_unique': len(cmds),
    'sorted': sorted(cmds.keys()),
    'counts': dict(cmds.most_common()),
    'by_category': {k: sorted(v) for k, v in sorted(per_cat.items())},
    'weird_chars': weird[:40],
}
print(json.dumps(out, indent=1))
