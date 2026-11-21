#!/usr/bin/env python3
"""Gör om en Grouvee-export (JSON) till data/library.json.

Användning: python3 tools/import_grouvee.py grouvee_export.json
Kontouppgifter (e-post m.m.) tas aldrig med.
"""
import json, sys

BASE = {  # Grouvee-hylla -> status. Ordningen = prioritet när ett spel ligger på flera.
    'Playing': 'playing',
    'abandoned': 'abandoned',
    'Backlog': 'backlog',
    'Wish List': 'wishlist',
    'Played': 'played',
}

def platform(names):
    for n in names:
        if n.startswith('PC'):
            return 'steam'
        if n.startswith('PlayStation'):
            return 'ps'
        if n.startswith('Xbox'):
            return 'xbox'
    return 'other' if names else None

def main(src, dst='data/library.json'):
    d = json.load(open(src, encoding='utf-8'))
    games, lists = [], {}
    for g in d['collection']:
        sh = g['shelves']
        status = next((BASE[k] for k in BASE if k in sh), 'backlog')
        conflict = sum(1 for k in BASE if k in sh) > 1
        added = min((v['date_added'] for v in sh.values() if v.get('date_added')), default='') or g['date_added_to_collection']
        praw = list(g['platforms'])
        games.append({
            'id': 'g%d' % g['id'],
            'n': g['name'],
            'igdb': g['igdb_id'],
            'rel': g['release_date'],
            's': status,
            'r': g['rating'] or 0,
            'p': platform(praw),
            'praw': praw,
            'gen': list(g['genres']),
            'dev': list(g['developers']),
            'add': added,
            'url': g['url'],
            **({'cf': 1} if conflict else {}),
        })
        for k, v in sh.items():
            if k in BASE:
                continue
            lists.setdefault(k, []).append((v.get('order') or 0, 'g%d' % g['id']))
    out_lists = [{'id': 'l%d' % i, 'name': name, 'ids': [x for _, x in sorted(items)]}
                 for i, (name, items) in enumerate(sorted(lists.items(), key=lambda kv: kv[0]))]
    json.dump({'source': 'grouvee', 'exported': d.get('exported_at'), 'games': games, 'lists': out_lists},
              open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(games), 'spel,', len(out_lists), 'listor,', sum(1 for g in games if g.get('cf')), 'med flera statusar')

if __name__ == '__main__':
    main(*sys.argv[1:])
