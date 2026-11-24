'use strict';
// Uppstart: läs grundbiblioteket och håll appen på senaste versionen.

// ---------- Version: ladda om när en ny version finns ----------
function checkVersion() {
  if (BUILD === 'dev') return;
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(v => {
    if (v.build && v.build !== BUILD && sessionStorage.getItem('reloaded') !== v.build) {
      sessionStorage.setItem('reloaded', v.build);
      location.replace(location.pathname + '?v=' + v.build);
    }
  }).catch(() => { });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });

// ---------- Start ----------
fetch('data/library.json?v=' + BUILD, { cache: 'no-cache' }).then(r => r.json()).then(d => {
  BASE = d; prune(); rebuild();
  if (history.state && history.state.tab) restore(history.state);   // t.ex. efter omladdning
  else { history.replaceState(snapshot(0), ''); render(); }
  checkVersion();
  syncNow();
  loadSteam();
}).catch(() => {
  rebuild(); render();
  $('#mbody').innerHTML = '<div class="empty">Kunde inte läsa biblioteket. Kolla nätet och ladda om.</div>';
});
