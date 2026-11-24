'use strict';
// Synk mellan telefon och dator via Workern (POST /sync, D1-databas).
// Appen skickar hela sin lokala PATCH; servern slår ihop med det som finns sparat och svarar med resultatet.
// Synkkoden (samma som SYNC_KEY i Cloudflare) sparas en gång per enhet i localStorage.

const SYNC = { key: ls('st_sync_key', ''), state: '', err: '', at: ls('st_sync_at', 0) };
let syncTimer = null, syncing = false, syncAgain = false;

// Samma regler som mergePatch i worker/worker.js (senaste ändringen per spel vinner).
function mergePatch(a, b) {
  a = a || {}; b = b || {};
  const out = { g: {}, add: [], del: {}, lists: null, lt: 0 };
  for (const src of [a, b]) {
    for (const [id, f] of Object.entries(src.g || {})) {
      const cur = out.g[id];
      out.g[id] = !cur ? { ...f } : (f.t || 0) >= (cur.t || 0) ? { ...cur, ...f } : { ...f, ...cur };
    }
    for (const [id, t] of Object.entries(src.del || {})) {
      if (!(id in out.del) || Math.abs(t) > Math.abs(out.del[id])) out.del[id] = t;
    }
    for (const x of src.add || []) if (!out.add.some(y => y.id === x.id)) out.add.push(x);
    if (src.lists && (src.lt || 0) >= out.lt) { out.lists = src.lists; out.lt = src.lt || 0; }
  }
  return out;
}

function syncSoon(ms = 1500) {
  if (!SYNC.key) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, ms);
}
async function syncNow() {
  if (!SYNC.key) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  SYNC.state = 'busy';
  try {
    const r = await fetch(API + '/sync', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SYNC.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch: PATCH })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 401 ? 'Fel synkkod' : d.error || 'Servern svarade ' + r.status);
    // Ändringar gjorda medan anropet pågick finns kvar i PATCH och vinner om de är nyare.
    PATCH = mergePatch(d.patch, PATCH);
    lsSet('st_patch_v1', PATCH);
    prune();
    rebuild();
    Object.assign(SYNC, { state: 'ok', err: '', at: Date.now() });
    lsSet('st_sync_at', SYNC.at);
  } catch (e) {
    Object.assign(SYNC, { state: 'err', err: e.message === 'Failed to fetch' ? 'Ingen kontakt med servern' : e.message });
  }
  syncing = false;
  // Rita om, men inte mitt i skrivande eller dragande (då ritas det om vid nästa tryck).
  const a = document.activeElement;
  if (!drag && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render();
  if (syncAgain) { syncAgain = false; syncSoon(300); }
}

function syncStatus() {
  if (!SYNC.key) return 'Av';
  if (SYNC.state === 'busy') return 'Synkar…';
  if (SYNC.state === 'err') return SYNC.err;
  if (!SYNC.at) return 'Inte synkad än';
  const d = new Date(SYNC.at), today = new Date().toDateString() === d.toDateString();
  return 'Synkad ' + (today ? '' : d.toLocaleDateString('sv-SE') + ' ') + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}
function connectSync() {
  const key = (prompt('Synkkod (samma som SYNC_KEY i Cloudflare). Sparas på den här enheten.') || '').trim();
  if (!key) return;
  SYNC.key = key;
  lsSet('st_sync_key', key);
  syncNow();
}
function disconnectSync() {
  if (!confirm('Sluta synka den här enheten? Inget raderas, ändringar sparas bara lokalt igen.')) return;
  Object.assign(SYNC, { key: '', state: '', err: '', at: 0 });
  lsSet('st_sync_key', '');
  lsSet('st_sync_at', 0);
  render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncNow(); loadSteam(); } });

// ---------- Steam: speltid och senast spelad (GET /steam, samma kod som synken) ----------
// Sparas per enhet i localStorage st_steam {t, games: [[appid, namn, minuter, senast (unix-sek), igdb|null]]}.
let STEAM = ls('st_steam', null), STEAMI = null, steamErr = '';
function steamIndex() {
  STEAMI = { ig: {}, nm: {} };
  ((STEAM && STEAM.games) || []).forEach(([app, n, mins, last, ig]) => {
    const x = { app, mins, last };
    if (ig) STEAMI.ig[ig] = x;
    STEAMI.nm[norm(n)] = x;
  });
}
// Steamdata för ett spel: först via IGDB-kopplingen, annars på namn.
function steamOf(g) {
  if (!STEAM) return null;
  if (!STEAMI) steamIndex();
  return (g.igdb && STEAMI.ig[g.igdb]) || STEAMI.nm[norm(g.n)] || null;
}
async function loadSteam(force) {
  if (!SYNC.key || (!force && STEAM && Date.now() - STEAM.at < 3600e3)) return;   // högst en gång i timmen
  try {
    const r = await fetch(API + '/steam' + (force ? '?refresh=1' : ''), { headers: { 'Authorization': 'Bearer ' + SYNC.key } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Servern svarade ' + r.status);
    STEAM = Object.assign(d, { at: Date.now() });
    lsSet('st_steam', STEAM);
    STEAMI = null;
    steamErr = '';
  } catch (e) { steamErr = e.message === 'Failed to fetch' ? 'Ingen kontakt med servern' : e.message; }
  const a = document.activeElement;
  if (!drag && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render();
}
function steamStatus() {
  if (steamErr) return steamErr;
  if (!STEAM) return 'Inte hämtad';
  return (STEAM.games || []).length + ' spel · ' + new Date(STEAM.t).toLocaleDateString('sv-SE');
}
// "för 3 dagar sedan · 42 h på Steam"
function steamLine(g) {
  const s = steamOf(g);
  if (!s || !s.mins) return '';
  const h = s.mins < 60 ? s.mins + '\u00a0min' : Math.round(s.mins / 60) + '\u00a0h';   // hårt mellanslag: siffran och h på samma rad
  let when = '';
  if (s.last) {
    const d = new Date(s.last * 1000), days = Math.floor((Date.now() - d) / 864e5);
    when = days < 1 ? 'i dag' : days < 2 ? 'i går' : days < 30 ? 'för ' + days + ' dagar sedan'
      : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return (when ? 'Senast spelad ' + when + ' · ' : '') + h + ' på Steam';
}
