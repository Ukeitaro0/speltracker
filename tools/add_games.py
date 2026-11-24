#!/usr/bin/env python3
"""Lägger till spel från IGDB i data/library.json (status Backlog).
  python3 tools/add_games.py find  namn.txt   → visar bästa IGDB-träff per rad (namn), sparar till /tmp-fri fil add_plan.json
  python3 tools/add_games.py apply add_plan.json → lägger in spelen (id g<igdb>), hoppar över dubbletter
Kräver TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET i miljön (som fetch_covers.py)."""
import json, os, sys, re, urllib.request, urllib.parse, datetime

CID, SEC = os.environ.get('TWITCH_CLIENT_ID'), os.environ.get('TWITCH_CLIENT_SECRET')
if not CID or not SEC: sys.exit('Saknar TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET i miljön')
def post(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
tok = post('https://id.twitch.tv/oauth2/token?' + urllib.parse.urlencode(
    {'client_id': CID, 'client_secret': SEC, 'grant_type': 'client_credentials'}))['access_token']
H = {'Client-ID': CID, 'Authorization': 'Bearer ' + tok, 'Accept': 'application/json'}
FIELDS = 'fields name,first_release_date,cover.image_id,platforms.abbreviation,genres.name,involved_companies.company.name,involved_companies.developer,aggregated_rating,rating,collections.name,game_type;'
norm = lambda s: re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

def find(path):
    plan = []
    for name in [l.strip() for l in open(path, encoding='utf-8') if l.strip()]:
        q = name.replace('"', '')
        res = post('https://api.igdb.com/v4/games', f'search "{q}"; {FIELDS} where version_parent = null; limit 10;'.encode(), H)
        best = next((r for r in res if norm(r['name']) == norm(name)), res[0] if res else None)
        y = best and best.get('first_release_date') and datetime.datetime.fromtimestamp(best['first_release_date'], datetime.timezone.utc).year
        print(f"{name:55} → {best['name'] + f' ({y}) id {best['id']}' if best else 'INGEN TRÄFF'}")
        if best: plan.append(best)
    json.dump(plan, open('add_plan.json', 'w'), ensure_ascii=False)

def apply(path):
    lib = json.load(open('data/library.json', encoding='utf-8'))
    have = {g.get('igdb') for g in lib['games']}
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'); n = 0
    for x in json.load(open(path)):
        if x['id'] in have: print('finns redan:', x['name']); continue
        comp = x.get('involved_companies') or []
        g = {'id': 'g%d' % x['id'], 'n': x['name'], 'igdb': x['id'],
             'rel': datetime.datetime.fromtimestamp(x['first_release_date'], datetime.timezone.utc).strftime('%Y-%m-%d') if x.get('first_release_date') else '',
             's': 'backlog', 'r': 0, 'p': None,
             'praw': [p['abbreviation'] for p in x.get('platforms') or [] if p.get('abbreviation')],
             'gen': [g['name'] for g in x.get('genres') or []],
             'dev': [c['company']['name'] for c in comp if c.get('developer') and c.get('company')],
             'add': now}
        if x.get('cover'): g['cov'] = x['cover']['image_id']
        if x.get('aggregated_rating'): g['cr'] = round(x['aggregated_rating'])
        if x.get('rating'): g['ur'] = round(x['rating'])
        ser = sorted(c['name'] for c in x.get('collections') or [])
        if ser: g['ser'] = ser
        lib['games'].append(g); have.add(x['id']); n += 1
    json.dump(lib, open('data/library.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(n, 'spel tillagda')

{'find': find, 'apply': apply}[sys.argv[1]](sys.argv[2])
