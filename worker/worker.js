// Speltrackerns server (Cloudflare Worker). Håller Twitch/IGDB-nyckeln hemlig och svarar appen.
// Hemligheterna TWITCH_CLIENT_ID och TWITCH_CLIENT_SECRET läggs in i Cloudflare under
// Worker → Settings → Variables and Secrets. De står aldrig i den här filen.
//
// GET /search?q=namn      → upp till 20 spel från IGDB (namn, år, omslag, plattformar, genre, utvecklare)
// GET /games?ids=1,2,3    → samma uppgifter för kända IGDB-id (max 500 per anrop)

const ALLOWED = ['https://ukeitaro0.github.io'];
const FIELDS = 'fields name,first_release_date,cover.image_id,platforms.abbreviation,genres.name,involved_companies.company.name,involved_companies.developer;';

let tok = null, tokExp = 0;

async function token(env) {
  if (tok && Date.now() < tokExp) return tok;
  const u = 'https://id.twitch.tv/oauth2/token?grant_type=client_credentials'
    + '&client_id=' + encodeURIComponent(env.TWITCH_CLIENT_ID)
    + '&client_secret=' + encodeURIComponent(env.TWITCH_CLIENT_SECRET);
  const r = await fetch(u, { method: 'POST' });
  if (!r.ok) throw new Error('Twitch svarade ' + r.status + ' (kolla id och secret)');
  const j = await r.json();
  tok = j.access_token;
  tokExp = Date.now() + (j.expires_in - 600) * 1000;
  return tok;
}

async function igdb(env, body) {
  const r = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': env.TWITCH_CLIENT_ID, 'Authorization': 'Bearer ' + await token(env), 'Accept': 'application/json' },
    body,
  });
  if (!r.ok) throw new Error('IGDB svarade ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}

function json(data, cors, status = 200, cache = '') {
  const h = { ...cors, 'Content-Type': 'application/json; charset=utf-8' };
  if (cache) h['Cache-Control'] = cache;
  return new Response(JSON.stringify(data), { status, headers: h });
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const ok = ALLOWED.includes(origin) || origin.startsWith('http://localhost');
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : ALLOWED[0], 'Access-Control-Allow-Methods': 'GET', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    try {
      if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) return json({ error: 'Hemligheterna saknas i Cloudflare' }, cors, 500);
      if (url.pathname === '/search') {
        const q = (url.searchParams.get('q') || '').replace(/["\\]/g, '').trim().slice(0, 100);
        if (!q) return json([], cors);
        return json(await igdb(env, `search "${q}"; ${FIELDS} where version_parent = null; limit 20;`), cors, 200, 'public, max-age=3600');
      }
      if (url.pathname === '/games') {
        const ids = (url.searchParams.get('ids') || '').split(',').map(Number).filter(n => n > 0).slice(0, 500);
        if (!ids.length) return json([], cors);
        return json(await igdb(env, `where id = (${ids.join(',')}); ${FIELDS} limit 500;`), cors, 200, 'public, max-age=86400');
      }
      return json({ ok: true, app: 'speltracker', twitch: (await token(env)) ? 'ok' : 'fel' }, cors);
    } catch (e) {
      return json({ error: String(e.message || e) }, cors, 502);
    }
  },
};
