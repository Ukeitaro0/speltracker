// Speltrackerns server (Cloudflare Worker). Håller Twitch/IGDB-nyckeln hemlig och svarar appen.
// Hemligheterna TWITCH_CLIENT_ID och TWITCH_CLIENT_SECRET läggs in i Cloudflare under
// Worker → Settings → Variables and Secrets. De står aldrig i den här filen.
//
// GET /search?q=namn      → upp till 20 spel från IGDB (namn, år, omslag, plattformar, genre, utvecklare)
// GET /games?ids=1,2,3    → samma uppgifter för kända IGDB-id (max 500 per anrop)
// POST /sync              → synk mellan enheter: appen skickar sina lokala ändringar {patch}, servern slår ihop
//                           dem med det som finns sparat (senaste ändringen vinner) och svarar med resultatet.
//                           Kräver huvudet Authorization: Bearer <SYNC_KEY> (Secret i Cloudflare) och en
//                           D1-databas kopplad som DB (Bindings).

const ALLOWED = ['https://ukeitaro0.github.io'];
const FIELDS = 'fields name,first_release_date,cover.image_id,platforms.abbreviation,genres.name,involved_companies.company.name,involved_companies.developer,aggregated_rating,rating,collections.name;';

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

// ---------- Synk ----------
// patch = {g: {spelId: {fält..., t}}, add: [spel], del: {spelId: t}, lists: [...] | null, lt}
// del: t > 0 = borttaget, t < 0 = återställt (vid tidpunkten |t|). Störst |t| vinner.
function mergePatch(a, b) {
  a = a || {}; b = b || {};
  const out = { g: {}, add: [], del: {}, lists: null, lt: 0 };
  for (const src of [a, b]) {
    for (const [id, f] of Object.entries(src.g || {})) {
      const cur = out.g[id];
      if (!cur) out.g[id] = { ...f };
      else out.g[id] = (f.t || 0) >= (cur.t || 0) ? { ...cur, ...f } : { ...f, ...cur };
    }
    for (const [id, t] of Object.entries(src.del || {})) {
      if (!(id in out.del) || Math.abs(t) > Math.abs(out.del[id])) out.del[id] = t;
    }
    for (const x of src.add || []) if (!out.add.some(y => y.id === x.id)) out.add.push(x);
    if (src.lists && (src.lt || 0) >= out.lt) { out.lists = src.lists; out.lt = src.lt || 0; }
  }
  return out;
}
function same(a, b) {   // jämför utan att läcka tid (konstant tid)
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sync(req, env, cors) {
  if (!env.SYNC_KEY || !env.DB) return json({ error: 'Synken är inte uppsatt (SYNC_KEY eller DB saknas)' }, cors, 500);
  const auth = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/, '');
  if (!same(auth, env.SYNC_KEY)) return json({ error: 'Fel synkkod' }, cors, 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.patch !== 'object') return json({ error: 'Ogiltig data' }, cors, 400);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS store (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL)').run();
  const row = await env.DB.prepare('SELECT v FROM store WHERE k = ?').bind('patch').first();
  const merged = mergePatch(row ? JSON.parse(row.v) : null, body.patch);
  const now = Date.now();
  await env.DB.prepare('INSERT INTO store (k, v, t) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, t = excluded.t')
    .bind('patch', JSON.stringify(merged), now).run();
  return json({ patch: merged, t: now }, cors);
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
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : ALLOWED[0], 'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/sync' && req.method === 'POST') return await sync(req, env, cors);
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
      return json({ ok: true, app: 'speltracker', twitch: (await token(env)) ? 'ok' : 'fel',
        sync: env.SYNC_KEY && env.DB ? 'ok' : 'ej uppsatt' }, cors);
    } catch (e) {
      return json({ error: String(e.message || e) }, cors, 502);
    }
  },
};
