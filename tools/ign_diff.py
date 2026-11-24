"""Jämför IGN Playlist (JSON från tools/ign_snippet.js) med data/library.json på titel.
Användning: python3 tools/ign_diff.py ign.json  → rapport på stdout."""
import json, re, sys, unicodedata, difflib

ROMAN = {'ii': '2', 'iii': '3', 'iv': '4', 'v': '5', 'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10'}

def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\[[^\]]*\]|\(\d{4}\)', ' ', s)           # [1992], [NES], (1993)
    s = s.replace('&', ' and ')
    s = re.sub(r"[’'`]", '', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    w = [ROMAN.get(x, x) for x in s.split()]
    w = [x for x in w if x not in STOP]
    return ' '.join(w)

# Ord som bara säger vilken utgåva det är – tas bort vid jämförelse
STOP = {'the', 'a', 'disneys', 'edition'}
nums = lambda k: {x for x in k.split() if x.isdigit()}

def close(k, keys):
    # Nära match bara om siffrorna är desamma (Black Ops ≠ Black Ops 6, FF 6 ≠ FF 9)
    for m in difflib.get_close_matches(k, keys, n=5, cutoff=0.75):
        if nums(m) == nums(k): return m
    # Den ena titeln börjar med hela den andra (undertitel), siffror lika
    for m in keys:
        a, b = (k, m) if len(k) < len(m) else (m, k)
        if a and (b + ' ').startswith(a + ' ') and nums(a) == nums(b) and len(a.split()) >= 2: return m
    return None

ign = json.load(open(sys.argv[1]))['g']
lib = json.load(open('data/library.json'))
games = lib['games']
L = {}
for g in games:
    L.setdefault(norm(g['n']), []).append(g)

exact, fuzzy, missing, used = [], [], [], set()
keys = list(L)
for x in ign:
    k = norm(x['n'])
    if k in L:
        exact.append((x, L[k][0])); used.add(L[k][0]['id']); continue
    m = close(k, keys)
    if m:
        fuzzy.append((x, L[m][0])); used.add(L[m][0]['id'])
    else:
        missing.append(x)
only_here = [g for g in games if g['id'] not in used]

print(f'IGN: {len(ign)} spel · Här: {len(games)} spel')
print(f'Exakt matchade: {len(exact)} · Nära match: {len(fuzzy)} · Bara på IGN: {len(missing)} · Bara här: {len(only_here)}\n')
print('## Nära match (kolla att de är samma spel)')
for x, g in fuzzy: print(f"  IGN: {x['n']}  ≈  här: {g['n']}")
print('\n## Bara på IGN')
for x in sorted(missing, key=lambda x: x['n'].lower()): print('  ' + x['n'])
print('\n## Bara här (status)')
for g in sorted(only_here, key=lambda g: g['n'].lower()): print(f"  {g['n']}  [{g['s']}]")
