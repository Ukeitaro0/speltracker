#!/usr/bin/env python3
"""Engångskörning (2026-11-22): fyller i konsolmodell utifrån Grouvees plattformar (praw) och
flyttar bort den gamla gruppen 'other'. Rör bara spel där svaret är entydigt."""
import json

RAW = {
    'PlayStation': 'ps1', 'PlayStation 2': 'ps2', 'PlayStation 3': 'ps3', 'PlayStation Network (PS3)': 'ps3',
    'PlayStation 4': 'ps4', 'PlayStation 5': 'ps5',
    'Xbox': 'xb', 'Xbox 360': 'x360', 'Xbox 360 Games Store': 'x360',
    'Xbox One': 'xsx', 'Xbox Series X|S': 'xsx',   # Robin har aldrig haft Xbox One
    'Nintendo Entertainment System': 'nes', 'Super Nintendo Entertainment System': 'snes', 'Nintendo 64': 'n64',
    'Nintendo Switch': 'nino', 'Wii': 'nino', 'Nintendo GameCube': 'nino',
    'Web Browser': 'pco',
}
FAM = {'ps1': 'ps', 'ps2': 'ps', 'ps3': 'ps', 'ps4': 'ps', 'ps5': 'ps', 'xb': 'xbox', 'x360': 'xbox', 'xsx': 'xbox',
       'nes': 'nin', 'snes': 'nin', 'n64': 'nin', 'nino': 'nin', 'pco': 'pc', 'steam': 'pc'}
OTHER = {'g127837': 'pco', 'g185009': 'pco', 'g173874': 'pco'}   # Larry, Family, Type Help

path = 'data/library.json'
lib = json.load(open(path, encoding='utf-8'))
n = 0

def resolve(g, p):
    """Ny plattform för p (familj eller 'other'), eller p oförändrad."""
    models = {RAW[r] for r in g.get('praw', []) if r in RAW}
    if p == 'other':
        if g['id'] in OTHER:
            return OTHER[g['id']]
        nin = [m for m in models if FAM[m] in ('nin', 'pc')]
        return nin[0] if len(nin) == 1 else p
    if p in ('ps', 'xbox'):
        same = [m for m in models if FAM[m] == p]
        return same[0] if len(set(same)) == 1 else p
    return p

for g in lib['games']:
    if g.get('p'):
        new = resolve(g, g['p'])
        if new != g['p']:
            g['p'] = new; n += 1
    for x in g.get('pl') or []:
        if x.get('p'):
            new = resolve(g, x['p'])
            if new != x['p']:
                x['p'] = new; n += 1
json.dump(lib, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
import collections
print(n, 'ändrade.', collections.Counter(g.get('p') for g in lib['games']))
