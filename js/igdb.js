'use strict';
// Sök i IGDB via vår Cloudflare Worker (worker/worker.js) och lägg till spel därifrån.
// Workern håller Twitch-nyckeln hemlig; appen pratar bara med den.

const API = 'https://speltracker.ukeitaro.workers.dev';
const IG = { q: '', busy: false, res: null, err: '' };   // senaste sökningen
const igCache = {};
let igTimer = null;

// Anropas när sökrutan ändras: väntar tills Robin slutat skriva en stund.
function igdbSearch(q) {
  q = q.trim();
  clearTimeout(igTimer);
  if (q.length < 2) { Object.assign(IG, { q, busy: false, res: null, err: '' }); return; }
  if (igCache[q]) { Object.assign(IG, { q, busy: false, res: igCache[q], err: '' }); return; }
  Object.assign(IG, { q, busy: true, err: '' });
  igTimer = setTimeout(() => {
    fetch(API + '/search?q=' + encodeURIComponent(q))
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d)) throw new Error(d.error || 'okänt fel');
        igCache[q] = d;
        if (IG.q === q) Object.assign(IG, { busy: false, res: d });
      })
      .catch(() => { if (IG.q === q) Object.assign(IG, { busy: false, res: null, err: 'Kunde inte nå IGDB just nu.' }); })
      .then(() => { if (UI.tab === 'search' && IG.q === q) renderBody(); });
  }, 350);
}

// IGDB-svar → spel i vårt format (samma fält som grundfilen).
function fromIgdb(x) {
  const rel = x.first_release_date ? new Date(x.first_release_date * 1000).toISOString().slice(0, 10) : '';
  const comp = (x.involved_companies || []);
  return {
    id: 'g' + x.id, n: x.name, igdb: x.id, rel, s: 'backlog', r: 0, p: null,
    praw: (x.platforms || []).map(p => p.abbreviation).filter(Boolean),
    gen: (x.genres || []).map(g => g.name),
    dev: comp.filter(c => c.developer && c.company).map(c => c.company.name),
    add: new Date().toISOString(),
    cov: x.cover && x.cover.image_id, cr: x.aggregated_rating && Math.round(x.aggregated_rating),
    ur: x.rating && Math.round(x.rating), ser: (x.collections || []).map(c => c.name).sort()
  };
}
function addFromIgdb(igdbId) {
  const x = (IG.res || []).find(r => r.id === igdbId);
  if (!x) return;
  const have = GAMES.find(h => h.igdb === igdbId);
  if (have) { openGame(have.id); return; }   // finns redan
  const g = fromIgdb(x);
  Object.keys(g).forEach(k => { if (g[k] === undefined || (Array.isArray(g[k]) && !g[k].length && k === 'ser')) delete g[k]; });
  if (!GM[g.id]) {
    if (BASE.games.some(b => b.id === g.id) || PATCH.add.some(b => b.id === g.id)) PATCH.del[g.id] = -Date.now();   // borttaget tidigare: ta tillbaka (negativt = återställt, se sync.js)
    else PATCH.add.push(g);
    save();
  }
  openGame(g.id);
  UI.so = true;   // välj status direkt
  renderGame();
}

// Resultatlistan under bibliotekets träffar.
function igdbResults() {
  if (IG.q.length < 2) return '';
  let body;
  if (IG.busy && !IG.res) body = '<div class="info">Söker i IGDB…</div>';
  else if (IG.err) body = `<div class="info">${esc(IG.err)}</div>`;
  else {
    const shown = new Set(searchHits(UI.q).slice(0, 8).map(g => g.igdb));   // redan listade under "I biblioteket"
    const res = (IG.res || []).filter(x => !shown.has(x.id));
    body = res.length ? `<div class="ro">${res.map(x => {
      const have = GAMES.find(g => g.igdb === x.id);
      const yr = x.first_release_date ? new Date(x.first_release_date * 1000).getFullYear() : '';
      const plat = (x.platforms || []).map(p => p.abbreviation).filter(Boolean).slice(0, 4).join(' · ');
      const act = have
        ? `<button class="igb have" data-act="game" data-id="${have.id}"><span class="dot" style="background:${SM[have.s].c}"></span>${SM[have.s].label}</button>`
        : `<button class="igb" data-act="igadd" data-i="${x.id}" aria-label="Lägg till ${esc(x.name)}">${ico('plus', 16)}Lägg till</button>`;
      return `<div class="ror">
        <span class="rc" style="background:${COVERS[x.id % COVERS.length]}">${x.cover ? `<img src="${IGDB_IMG}t_cover_small/${x.cover.image_id}.jpg" alt="" loading="lazy">` : ''}</span>
        <span class="rt"><b>${esc(x.name)}</b><small>${[yr, plat].filter(Boolean).join(' · ')}</small></span>
        ${act}</div>`;
    }).join('')}</div>` : '<div class="info">Inga fler träffar i IGDB.</div>';
  }
  return `<div class="sect" style="padding-left:4px">Från IGDB</div>${body}`;
}
