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
// GET /steam              → dina Steam-spel med speltid och senast spelad (sparat i D1, hämtas en gång per dygn
//                           av Cron-triggern och direkt med ?refresh=1). Samma Authorization som /sync.
//                           Kräver Secret STEAM_KEY (Steam Web API-nyckel) och variabeln STEAM_ID (SteamID64).
// GET /xbox               → dina Xbox-spel med senast spelad, via OpenXBL (xbl.io). Som /steam.
//                           Kräver Secret XBL_KEY (API-nyckel från xbl.io).
// GET /psn                → dina PlayStation-spel (PS4/PS5) med speltid och senast spelad. Som /steam.
//                           Inofficiellt (samma väg som Sonys app). Kräver Secret PSN_NPSSO: logga in på
//                           playstation.com och öppna https://ca.account.sony.com/api/v1/ssocookie – värdet "npsso".
//                           Gäller ungefär två månader, sedan måste det bytas.

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

// ---------- Steam ----------
// Sparas som {t, games: [[appid, namn, minuter, senast spelad (unix-sek), igdb-id|null]]}.
async function steamFetch(env) {
  if (!env.STEAM_KEY || !env.STEAM_ID) throw new Error('STEAM_KEY eller STEAM_ID saknas i Cloudflare');
  const u = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?include_appinfo=1&include_played_free_games=1'
    + '&key=' + encodeURIComponent(env.STEAM_KEY) + '&steamid=' + encodeURIComponent(env.STEAM_ID);
  const r = await fetch(u);
  if (!r.ok) throw new Error('Steam svarade ' + r.status + (r.status === 401 || r.status === 403 ? ' (kolla nyckeln)' : ''));
  const list = ((await r.json()).response || {}).games;
  if (!list) throw new Error('Steam gav inga spel – är Speldetaljer offentliga i profilens sekretessinställningar?');
  // Steams app-id → IGDB-id (external_game_source 1 = Steam), 500 åt gången
  const map = {};
  for (let i = 0; i < list.length; i += 500) {
    const ids = list.slice(i, i + 500).map(g => '"' + g.appid + '"').join(',');
    const res = await fetch('https://api.igdb.com/v4/external_games', {
      method: 'POST',
      headers: { 'Client-ID': env.TWITCH_CLIENT_ID, 'Authorization': 'Bearer ' + await token(env), 'Accept': 'application/json' },
      body: `fields game,uid; where external_game_source = 1 & uid = (${ids}); limit 500;`,
    });
    if (res.ok) (await res.json()).forEach(x => { map[x.uid] = x.game; });
  }
  const data = { t: Date.now(), games: list.map(g => [g.appid, g.name, g.playtime_forever || 0, g.rtime_last_played || 0, map[g.appid] || null]) };
  await saveStore(env, 'steam', data);
  return data;
}
// ---------- Xbox (OpenXBL) ----------
// Sparas som {t, games: [[titleId, namn, senast spelad (unix-sek), enheter]]}.
async function xboxFetch(env) {
  if (!env.XBL_KEY) throw new Error('XBL_KEY saknas i Cloudflare');
  const r = await fetch('https://xbl.io/api/v2/player/titleHistory', { headers: { 'X-Authorization': env.XBL_KEY, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('OpenXBL svarade ' + r.status + (r.status === 401 || r.status === 403 ? ' (kolla nyckeln)' : ''));
  const j = await r.json();
  const list = j.titles || (j.content && j.content.titles);
  if (!Array.isArray(list)) throw new Error('OpenXBL gav inga spel (fält: ' + Object.keys(j).join(', ').slice(0, 120) + ')');
  const last = t => { const d = t.titleHistory && t.titleHistory.lastTimePlayed; return d ? Math.floor(Date.parse(d) / 1000) || 0 : 0; };
  const data = { t: Date.now(), games: list.filter(t => t.type !== 'App').map(t => [t.titleId, t.name, last(t), (t.devices || []).join(',')]) };
  await saveStore(env, 'xbox', data);
  return data;
}
// ---------- PlayStation (inofficiellt) ----------
// npsso → engångskod → åtkomstnyckel → spellista. Sparas som {t, games: [[titleId, namn, minuter, senast (unix-sek)]]}.
const PSN_AUTH = 'https://ca.account.sony.com/api/authz/v3/oauth';
const PSN_APP = { id: '09515159-7237-4370-9b40-3806e67c0891', redirect: 'com.scee.psxandroid.scecompcall://redirect',
  basic: 'MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=' };
async function psnToken(env) {
  const q = new URLSearchParams({ access_type: 'offline', client_id: PSN_APP.id, redirect_uri: PSN_APP.redirect,
    response_type: 'code', scope: 'psn:mobile.v2.core psn:clientapp' });
  const r = await fetch(PSN_AUTH + '/authorize?' + q, { headers: { Cookie: 'npsso=' + env.PSN_NPSSO }, redirect: 'manual' });
  const code = new URL(r.headers.get('Location') || 'x:/', 'x:/').searchParams.get('code');
  if (!code) throw new Error('PSN tog inte emot npsso – hämta en ny (logga in på playstation.com, se kommentaren i worker.js)');
  const t = await fetch(PSN_AUTH + '/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + PSN_APP.basic, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, redirect_uri: PSN_APP.redirect, grant_type: 'authorization_code', token_format: 'jwt' }),
  });
  if (!t.ok) throw new Error('PSN-inloggningen svarade ' + t.status);
  return (await t.json()).access_token;
}
const isoMin = d => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(d || ''); return m ? ((+m[1] || 0) * 24 + (+m[2] || 0)) * 60 + (+m[3] || 0) : 0; };   // "PT228H56M33S"
async function psnFetch(env) {
  if (!env.PSN_NPSSO) throw new Error('PSN_NPSSO saknas i Cloudflare');
  const tk = await psnToken(env), games = [];
  for (let off = 0, i = 0; off !== undefined && off !== null && i < 20; i++) {
    const r = await fetch('https://m.np.playstation.com/api/gamelist/v2/users/me/titles?categories=ps4_game,ps5_native_game&limit=200&offset=' + off,
      { headers: { 'Authorization': 'Bearer ' + tk } });
    if (!r.ok) throw new Error('PSN svarade ' + r.status);
    const j = await r.json();
    (j.titles || []).forEach(x => games.push([x.titleId, x.name, isoMin(x.playDuration),
      x.lastPlayedDateTime ? Math.floor(Date.parse(x.lastPlayedDateTime) / 1000) || 0 : 0]));
    off = j.nextOffset;
  }
  const data = { t: Date.now(), games };
  await saveStore(env, 'psn', data);
  return data;
}
async function saveStore(env, k, data) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS store (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL)').run();
  await env.DB.prepare('INSERT INTO store (k, v, t) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, t = excluded.t')
    .bind(k, JSON.stringify(data), data.t).run();
}
// GET /steam och /xbox: sparat resultat, eller hämta nu (?refresh=1 eller om inget finns sparat).
async function account(req, env, cors, url, k, fetcher) {
  if (!env.SYNC_KEY || !env.DB) return json({ error: 'Synken är inte uppsatt (SYNC_KEY eller DB saknas)' }, cors, 500);
  const auth = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/, '');
  if (!same(auth, env.SYNC_KEY)) return json({ error: 'Fel synkkod' }, cors, 401);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS store (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL)').run();
  const row = await env.DB.prepare('SELECT v FROM store WHERE k = ?').bind(k).first();
  if (row && url.searchParams.get('refresh') !== '1') return json(JSON.parse(row.v), cors);
  return json(await fetcher(env), cors);
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
      if (url.pathname === '/steam') return await account(req, env, cors, url, 'steam', steamFetch);
      if (url.pathname === '/xbox') return await account(req, env, cors, url, 'xbox', xboxFetch);
      if (url.pathname === '/psn') return await account(req, env, cors, url, 'psn', psnFetch);
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
        sync: env.SYNC_KEY && env.DB ? 'ok' : 'ej uppsatt', steam: env.STEAM_KEY && env.STEAM_ID ? 'ok' : 'ej uppsatt',
        xbox: env.XBL_KEY ? 'ok' : 'ej uppsatt', psn: env.PSN_NPSSO ? 'ok' : 'ej uppsatt' }, cors);
    } catch (e) {
      return json({ error: String(e.message || e) }, cors, 502);
    }
  },
  // Cron-trigger (Settings → Triggers → Cron, t.ex. 0 4 * * *): hämtar kontona en gång per dygn.
  async scheduled(event, env, ctx) {
    if (!env.DB) return;
    if (env.STEAM_KEY && env.STEAM_ID) ctx.waitUntil(steamFetch(env));
    if (env.XBL_KEY) ctx.waitUntil(xboxFetch(env));
    if (env.PSN_NPSSO) ctx.waitUntil(psnFetch(env));
  },
};
