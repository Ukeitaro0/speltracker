#!/usr/bin/env python3
"""Hämtar omslag (IGDB image_id) samt kritikerbetyg (cr) och användarbetyg (ur), 0–100, till alla spel i data/library.json som har igdb-id.

Kräver miljövariablerna TWITCH_CLIENT_ID och TWITCH_CLIENT_SECRET (sätts i molnmiljöns
inställningar, aldrig i repot). Användning: python3 tools/fetch_covers.py
Omslagsbilden visas sedan från https://images.igdb.com/igdb/image/upload/t_cover_big/<cov>.jpg
"""
import json, os, sys, urllib.request, urllib.parse

CID, SEC = os.environ.get('TWITCH_CLIENT_ID'), os.environ.get('TWITCH_CLIENT_SECRET')
if not CID or not SEC:
    sys.exit('Saknar TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET i miljön')

def post(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

tok = post('https://id.twitch.tv/oauth2/token?' + urllib.parse.urlencode(
    {'client_id': CID, 'client_secret': SEC, 'grant_type': 'client_credentials'}))['access_token']
H = {'Client-ID': CID, 'Authorization': 'Bearer ' + tok, 'Accept': 'application/json'}

path = 'data/library.json'
lib = json.load(open(path, encoding='utf-8'))
games = [g for g in lib['games'] if g.get('igdb')]
found = 0
for i in range(0, len(games), 400):
    chunk = games[i:i + 400]
    ids = ','.join(str(g['igdb']) for g in chunk)
    res = post('https://api.igdb.com/v4/games', f'where id = ({ids}); fields cover.image_id,aggregated_rating,rating; limit 500;'.encode(), H)
    cov = {r['id']: r['cover']['image_id'] for r in res if r.get('cover')}
    rat = {r['id']: r for r in res}
    for g in chunk:
        x = rat.get(g['igdb'], {})
        for k, f in (('cr', 'aggregated_rating'), ('ur', 'rating')):
            if x.get(f): g[k] = round(x[f])
            else: g.pop(k, None)
        if g['igdb'] in cov:
            g['cov'] = cov[g['igdb']]; found += 1
json.dump(lib, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{found} av {len(lib["games"])} spel har omslag, {sum(1 for g in lib["games"] if g.get("cr"))} kritikerbetyg, {sum(1 for g in lib["games"] if g.get("ur"))} användarbetyg')
