#!/usr/bin/env python3
"""Slår ihop ändringar som Robin kopierat från appen (Mer → Kopiera ändringar) med data/library.json.

Användning: python3 tools/merge_patch.py patch.json
"""
import json, sys

FIELDS = ('s', 'r', 'p', 'note', 'pl', 'dx')

def main(src, dst='data/library.json'):
    patch = json.load(open(src, encoding='utf-8'))['patch']
    lib = json.load(open(dst, encoding='utf-8'))
    by_id = {g['id']: g for g in lib['games']}
    changed = 0
    for gid, f in (patch.get('g') or {}).items():
        g = by_id.get(gid)
        if not g:
            g = next((a for a in patch.get('add') or [] if a['id'] == gid), None)
            if not g:
                print('okänt spel', gid); continue
        for k in FIELDS:
            if k in f and g.get(k) != f[k]:
                g[k] = f[k]; changed += 1
        if g.get('note') == '':
            g.pop('note')
        if g.get('pl') == []:
            g.pop('pl')
        if g.get('dx') == {}:
            g.pop('dx')
        # Plattform satt utan genomspelningar i patchen (äldre appversion): fyll i där plattform saknas.
        if f.get('p') and 'pl' not in f:
            for x in g.get('pl') or []:
                if not x.get('p'):
                    x['p'] = f['p']; changed += 1
        if 's' in f:
            g.pop('cf', None)
    for a in patch.get('add') or []:
        if a['id'] not in by_id:
            a = {k: v for k, v in a.items() if k != 't'}
            lib['games'].append(a); by_id[a['id']] = a; changed += 1
    for gid, t in (patch.get('del') or {}).items():
        if t > 0 and gid in by_id:   # t < 0 = återställt
            lib['games'] = [g for g in lib['games'] if g['id'] != gid]; changed += 1
            for l in lib['lists']:
                l['ids'] = [x for x in l['ids'] if x != gid]
    if patch.get('lists') is not None:
        lib['lists'] = [{'id': l['id'], 'name': l['name'], 'ids': [x for x in l['ids'] if x in by_id]} for l in patch['lists']]
        changed += 1
    json.dump(lib, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(changed, 'ändringar inlagda')

if __name__ == '__main__':
    main(*sys.argv[1:])
