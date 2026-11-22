#!/usr/bin/env python3
"""Engångskonvertering: listorna "played ÅÅÅÅ" blir genomspelningar (pl) på spelen i data/library.json.

pl = [{y: år, p: plattform|None, o: 'played'|'abandoned'|None (pågår)}], äldst först.
Utfall = spelets nuvarande status om den är Klarat/Gett upp, annars pågår (None).
Spel med status Spelar/Spelar om utan pågående genomspelning får en för innevarande år.
Listorna ändras inte. Kan köras flera gånger (lägger inte till dubbletter).
"""
import json, re, datetime

path = 'data/library.json'
lib = json.load(open(path, encoding='utf-8'))
G = {g['id']: g for g in lib['games']}
now = datetime.date.today().year
added = 0
for l in lib['lists']:
    m = re.match(r'^played (\d{4})$', l['name'], re.I)
    if not m:
        continue
    y = int(m.group(1))
    for gid in dict.fromkeys(l['ids']):
        g = G.get(gid)
        if not g:
            continue
        pl = g.setdefault('pl', [])
        if any(x['y'] == y for x in pl):
            continue
        pl.append({'y': y, 'p': g.get('p'), 'o': g['s'] if g['s'] in ('played', 'abandoned') else None})
        added += 1
for g in lib['games']:
    if g.get('pl'):
        g['pl'].sort(key=lambda x: x['y'])
        # bara det senaste kan vara pågående; äldre år räknas som avslutade med samma utfall
        for x in g['pl'][:-1]:
            if x['o'] is None:
                x['o'] = g['s'] if g['s'] in ('played', 'abandoned') else None
    if g['s'] in ('playing', 'replaying') and not (g.get('pl') and g['pl'][-1]['o'] is None and g['pl'][-1]['y'] == now):
        g.setdefault('pl', []).append({'y': now, 'p': g.get('p'), 'o': None}); added += 1
json.dump(lib, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
multi = [g['n'] for g in lib['games'] if len(g.get('pl', [])) > 1]
print(added, 'genomspelningar,', sum(1 for g in lib['games'] if g.get('pl')), 'spel. Flera år:', multi)
