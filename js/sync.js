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
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
