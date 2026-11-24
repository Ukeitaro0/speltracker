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

// ---------- Spelkonton: Steam, Xbox och PlayStation (GET /steam, /xbox, /psn – samma kod som synken) ----------
// Sparas per enhet i localStorage st_steam / st_xbox / st_psn.
//   steam: {t, games: [[appid, namn, minuter, senast (unix-sek), igdb|null]]}
//   xbox:  {t, games: [[titleId, namn, senast (unix-sek), enheter]]}
//   psn:   {t, games: [[titleId, namn, minuter, senast (unix-sek)]]}
const ACC = { steam: ls('st_steam', null), xbox: ls('st_xbox', null), psn: ls('st_psn', null) };
const ACC_ERR = { steam: '', xbox: '', psn: '' };
let ACCI = null;
function accIndex() {
  ACCI = { sIg: {}, sNm: {}, xNm: {}, pNm: {} };
  ((ACC.steam && ACC.steam.games) || []).forEach(([app, n, mins, last, ig]) => {
    const x = { mins, last };
    if (ig) ACCI.sIg[ig] = x;
    ACCI.sNm[norm(n)] = x;
  });
  ((ACC.xbox && ACC.xbox.games) || []).forEach(([id, n, last]) => { ACCI.xNm[norm(n)] = { last }; });
  ((ACC.psn && ACC.psn.games) || []).forEach(([id, n, mins, last]) => {   // samma spel kan finnas för PS4 och PS5: lägg ihop
    const k = norm(n), o = ACCI.pNm[k];
    ACCI.pNm[k] = o ? { mins: o.mins + mins, last: Math.max(o.last, last) } : { mins, last };
  });
}
// Steam via IGDB-kopplingen, annars på namn. Xbox på namn.
function steamOf(g) {
  if (!ACC.steam) return null;
  if (!ACCI) accIndex();
  return (g.igdb && ACCI.sIg[g.igdb]) || ACCI.sNm[norm(g.n)] || null;
}
function xboxOf(g) {
  if (!ACC.xbox) return null;
  if (!ACCI) accIndex();
  return ACCI.xNm[norm(g.n)] || null;
}
function psnOf(g) {
  if (!ACC.psn) return null;
  if (!ACCI) accIndex();
  return ACCI.pNm[norm(g.n)] || null;
}
// Senast spelad (unix-sek) på något konto, och var.
function lastPlayed(g) {
  return [[steamOf(g), 'Steam'], [xboxOf(g), 'Xbox'], [psnOf(g), 'PlayStation']]
    .filter(([x]) => x && x.last).map(([x, src]) => ({ t: x.last, src })).sort((a, b) => b.t - a.t)[0] || null;
}
async function loadAccount(k, force) {
  const cur = ACC[k];
  if (!force && cur && Date.now() - cur.at < 3600e3) return;   // högst en gång i timmen
  try {
    const r = await fetch(API + '/' + k + (force ? '?refresh=1' : ''), { headers: { 'Authorization': 'Bearer ' + SYNC.key } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Servern svarade ' + r.status);
    ACC[k] = Object.assign(d, { at: Date.now() });
    lsSet('st_' + k, ACC[k]);
    ACCI = null;
    ACC_ERR[k] = '';
  } catch (e) { ACC_ERR[k] = e.message === 'Failed to fetch' ? 'Ingen kontakt med servern' : e.message; }
}
async function loadSteam(force) {   // båda kontona (namnet kvar sedan Steam kom först)
  if (!SYNC.key) return;
  await Promise.all([loadAccount('steam', force), loadAccount('xbox', force), loadAccount('psn', force)]);
  const a = document.activeElement;
  if (!drag && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render();
}
function steamStatus() {
  const one = (k, label) => ACC_ERR[k] ? label + ': ' + ACC_ERR[k] : ACC[k] ? label + ' ' + (ACC[k].games || []).length : '';
  return [one('steam', 'Steam'), one('xbox', 'Xbox'), one('psn', 'PS')].filter(Boolean).join(' · ') || 'Inte hämtad';
}
// "Senast spelad för 3 dagar sedan på Xbox · 21 h på Steam · 40 h på PlayStation"
function steamLine(g) {
  const lp = lastPlayed(g), parts = [];
  const hours = [[steamOf(g), 'Steam'], [psnOf(g), 'PlayStation']].filter(([x]) => x && x.mins)
    .map(([x, src]) => ({ src, t: (x.mins < 60 ? x.mins + ' min' : Math.round(x.mins / 60) + ' h') + ' på ' + src }));   // hårt mellanslag
  if (lp) {
    const d = new Date(lp.t * 1000), days = Math.floor((Date.now() - d) / 864e5);
    const when = days < 1 ? 'i dag' : days < 2 ? 'i går' : days < 30 ? 'för ' + days + ' dagar sedan'
      : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
    // "på X" behövs inte om raden ändå slutar med timmar på samma konto
    parts.push('Senast spelad ' + when + (hours.length === 1 && hours[0].src === lp.src ? '' : ' på ' + lp.src));
  }
  return parts.concat(hours.map(h => h.t)).join(' · ');
}
