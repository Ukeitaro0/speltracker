#!/usr/bin/env python3
"""Hämtar tillägg (IGDB expansions + dlcs) till alla spel i data/library.json → g['dlc'] = [[igdb-id, namn, år], ...].
Kräver TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET (som fetch_covers.py). Användning: python3 tools/fetch_dlc.py"""
import json, os, sys, urllib.request, urllib.parse, datetime
CID, SEC = os.environ.get('TWITCH_CLIENT_ID'), os.environ.get('TWITCH_CLIENT_SECRET')
if not CID or not SEC: sys.exit('Saknar TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET i miljön')
def post(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
tok = post('https://id.twitch.tv/oauth2/token?' + urllib.parse.urlencode(
    {'client_id': CID, 'client_secret': SEC, 'grant_type': 'client_credentials'}))['access_token']
H = {'Client-ID': CID, 'Authorization': 'Bearer ' + tok}
lib = json.load(open('data/library.json', encoding='utf-8'))
games = [g for g in lib['games'] if g.get('igdb')]
yr = lambda x: datetime.datetime.fromtimestamp(x['first_release_date'], datetime.timezone.utc).year if x.get('first_release_date') else None
n = 0
for i in range(0, len(games), 400):
    chunk = games[i:i + 400]
    res = post('https://api.igdb.com/v4/games', (f'where id = ({",".join(str(g["igdb"]) for g in chunk)}); '
        'fields expansions.name,expansions.first_release_date,dlcs.name,dlcs.first_release_date; limit 500;').encode(), H)
    by = {r['id']: r for r in res}
    for g in chunk:
        x = by.get(g['igdb'], {})
        d = {e['id']: e for e in (x.get('expansions') or []) + (x.get('dlcs') or [])}
        lst = sorted(([e['id'], e['name'], yr(e)] for e in d.values()), key=lambda e: (e[2] or 9999, e[1]))
        if lst: g['dlc'] = lst; n += 1
        else: g.pop('dlc', None)
json.dump(lib, open('data/library.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(n, 'spel har tillägg,', sum(len(g.get('dlc', [])) for g in lib['games']), 'tillägg totalt')
