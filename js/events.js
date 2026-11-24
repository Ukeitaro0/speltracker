'use strict';
// Händelser: knappar har data-act="namn" och hanteras av ACTIONS[namn](knapp, spel).
// g = spelet som är öppet på spelkortet (annars undefined).

// ---------- Navigering med historik ----------
// Varje steg (kategori, lista, serie, utvecklare, år, spelkort) sparas i webbläsarens historik:
// {tab, f, year, game, sub, d, y}. d = antal steg från fliken (styr tillbaka-pilen), y = scrollläge.
// Tillbaka-pilen och webbläsarens bakåt går samma väg: history.back() → popstate → restore().
const depth = () => (history.state && history.state.d) || 0;
const snapshot = d => ({ tab: UI.tab, f: V.f, year: UI.year, game: UI.game, sub: UI.sub, d });
const CLOSED = { sheet: false, so: false, pm: false, gm: false, big: false };

function go(ch, root) {
  // Kom ihåg var vi var på sidan vi lämnar.
  if (history.state) history.replaceState(Object.assign({}, history.state, { y: scrollY }), '');
  const d = root ? 0 : depth() + 1;
  if ('f' in ch) { setView({ f: ch.f }); UI.reorder = null; UI.q = ''; }
  if ('tab' in ch) { UI.tab = ch.tab; if (ch.tab !== 'search') UI.q = ''; }
  if ('year' in ch) UI.year = ch.year;
  Object.assign(UI, CLOSED, { game: ch.game || null, sub: ch.sub || null });
  history.pushState(snapshot(d), '');
  if (ch.game && Object.keys(ch).every(k => k === 'game' || k === 'sub')) {   // bara spelkortet ändras, resten står kvar
    renderGame();
    const gp = $('#game .gp');
    if (gp) gp.scrollTop = 0;
  } else {
    render();
    scrollTo(0, 0);
  }
}
function restore(s) {
  setView({ f: s.f });
  Object.assign(UI, CLOSED, { tab: s.tab, year: s.year, game: s.game, sub: s.sub || null, reorder: null });
  if (s.tab !== 'search') UI.q = '';
  render();
  scrollTo(0, s.y || 0);
}
addEventListener('popstate', e => { if (e.state) restore(e.state); });

const openGame = id => go({ game: id });
function closeGame() {
  // Från en undersida (t.ex. Genomspelningar) stängs hela spelkortet: två steg tillbaka.
  if (history.state && history.state.game) history.go(history.state.sub ? -2 : -1);
  else { UI.game = null; render(); }
}

function newList(addGame) {
  const name = (prompt('Namn på den nya listan') || '').trim();
  if (!name) return;
  editLists(L => { L.push({ id: 'l' + Date.now(), name, ids: addGame ? [addGame] : [] }); });
  toast('Listan ”' + name + '” skapad');
}
const toggleGamePart = key => () => { UI[key] = !UI[key]; renderGame(); };

const ACTIONS = {
  // Navigering
  game: b => openGame(b.dataset.id),
  close: () => closeGame(),
  sheet: () => { if (!isDesk()) { UI.sheet = true; renderSheet(); } },
  sheetclose: () => { UI.sheet = false; renderSheet(); },
  back: () => history.back(),
  filter: b => go({ f: b.dataset.f, tab: 'lib' }, UI.tab !== 'lib'),   // från annan flik = ny början
  tab: b => {
    go({ tab: b.dataset.tab, year: null }, true);
    if (UI.tab === 'search') { const q = $('#q'); if (q) q.focus(); }
  },
  year: b => go({ year: +b.dataset.y }),
  // Från spelkortet: visa alla spel i samma serie / av samma utvecklare. Tillbaka öppnar spelkortet igen.
  ser: b => go({ f: 'ser:' + b.dataset.v, tab: 'lib' }),
  dev: b => go({ f: 'dev:' + b.dataset.v, tab: 'lib' }),

  qclear: () => {
    const q = $('#q');
    UI.q = '';
    if (q) { q.value = ''; q.focus(); }
    if (UI.tab === 'search') igdbSearch('');
    renderBody();
  },
  totop: () => scrollTo({ top: 0, behavior: 'smooth' }),

  // Spelkortet
  so: toggleGamePart('so'),
  pm: toggleGamePart('pm'),
  gm: toggleGamePart('gm'),
  sub: (b, g) => go({ game: g.id, sub: b.dataset.k }),
  dlc: (b, g) => setDlc(g, b.dataset.i, b.dataset.i in (g.dx || {}) ? null : 0),
  dlcr: (b, g) => { const n = +b.dataset.n; setDlc(g, b.dataset.i, n === (g.dx || {})[b.dataset.i] ? 0 : n); },
  big: () => { UI.gm = false; UI.big = true; renderGame(); },
  bigclose: toggleGamePart('big'),
  status: (b, g) => { UI.so = false; if (b.dataset.s !== g.s) setStatus(g, b.dataset.s); else renderGame(); },
  rate: (b, g) => { const n = +b.dataset.n; setGame(g.id, { r: n === g.r ? 0 : n }); },
  // Familj: menyn står kvar om familjen har modeller att välja bland. Samma familj igen = ingen plattform.
  plat: (b, g) => {
    const p = g.p && famOf(g.p) === b.dataset.p ? null : b.dataset.p, f = FAMS.find(x => x.id === p);
    UI.pm = !!(f && f.models.length);
    setPlatform(g, p);
  },
  platm: (b, g) => { UI.pm = false; setPlatform(g, g.p === b.dataset.p ? famOf(b.dataset.p) : b.dataset.p); },   // modell
  pladd: (b, g) => {
    const pl = plCopy(g);
    pl.push({ y: NOWY, p: g.p || null, o: 'played' });
    pl.sort((a, c) => a.y - c.y);
    setPl(g, pl, L => addToYear(L, g.id, NOWY));
  },
  pldel: (b, g) => {
    const pl = plCopy(g), i = +b.dataset.i, x = pl[i];
    if (!x || !confirm('Ta bort genomspelningen ' + x.y + '?')) return;
    pl.splice(i, 1);
    // Ligger kvar i årslistan bara om spelet har en annan genomspelning samma år.
    setPl(g, pl, pl.some(z => z.y === x.y) ? null : L => dropFromYear(L, g.id, x.y));
  },
  delgame: (b, g) => {
    UI.gm = false;
    if (!confirm('Ta bort ”' + g.n + '” ur biblioteket?')) { renderGame(); return; }
    PATCH.del[g.id] = Date.now();
    closeGame();
    save();
  },

  // Listor
  togglelist: (b, g) => editLists(L => {
    const l = L.find(x => x.id === b.dataset.l), i = l.ids.indexOf(g.id);
    if (i >= 0) l.ids.splice(i, 1); else l.ids.push(g.id);
  }),
  newlist: (b, g) => newList(b.dataset.addgame && g ? g.id : null),
  renamelist: () => {
    const c = current();
    if (!c.list) return;
    const name = (prompt('Nytt namn', c.list.name) || '').trim();
    if (name) editLists(L => { L.find(x => x.id === c.list.id).name = name; });
  },
  dellist: () => {
    const c = current();
    if (!c.list || !confirm('Ta bort listan ”' + c.list.name + '”? Spelen ligger kvar i biblioteket.')) return;
    editLists(L => { L.splice(L.findIndex(x => x.id === c.list.id), 1); });
    setView({ f: 'all' });
    render();
  },
  reorder: () => { const c = current(); if (c.list) { UI.reorder = c.list.id; renderBody(); } },
  reorderdone: () => { UI.reorder = null; renderBody(); },

  // Sök och Mer
  igadd: b => addFromIgdb(+b.dataset.i),
  addman: () => {
    const name = UI.q.trim();
    if (!name) return;
    const id = 'c' + Date.now();
    PATCH.add.push({ id, n: name, igdb: null, rel: '', s: 'backlog', r: 0, p: null, praw: [], gen: [], dev: [], add: new Date().toISOString() });
    save();
    openGame(id);
    UI.so = true;
    renderGame();
  },
  fold: b => { toggleFold(b.dataset.k); renderSide(); renderSheet(); if (UI.tab === 'lists') renderBody(); },
  synckey: () => connectSync(),
  syncnow: () => { syncNow(); renderBody(); },
  syncoff: () => disconnectSync(),
  export: () => {
    const txt = JSON.stringify({ speltracker: BUILD, patch: PATCH });
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
      .then(() => toast('Kopierat. Klistra in i chatten med Claude.'), () => { prompt('Kopiera texten:', txt); });
  },
  wipe: () => {
    if (!UI.wipe) {   // första trycket: be om bekräftelse i 4 s
      UI.wipe = 1;
      renderBody();
      setTimeout(() => { UI.wipe = 0; if (UI.tab === 'more') renderBody(); }, 4000);
    } else {
      PATCH = { g: {}, add: [], del: {}, lists: null };
      UI.wipe = 0;
      save();
      toast('Lokala ändringar slängda');
    }
  }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  const fn = b && ACTIONS[b.dataset.act];
  if (fn) fn(b, UI.game && GM[UI.game]);
});

// Rullgardiner och notering (sparas när fältet lämnas)
document.addEventListener('change', e => {
  const t = e.target, act = t.dataset.act, g = UI.game && GM[UI.game];
  if (act === 'sort') { setView({ sort: t.value }); renderBody(); return; }
  if (act === 'yearsel') { if (t.value) go({ year: +t.value }); else go({ tab: 'stats', year: null }, true); return; }
  if (!g) return;
  if (act === 'ply' || act === 'plp' || act === 'plo') {
    const pl = plCopy(g), x = pl[+t.dataset.i], v = t.value;
    if (!x) return;
    if (act === 'plp') { x.p = v || null; setPl(g, pl); }
    else if (act === 'plo') { x.o = v || null; setPl(g, pl); }
    else {   // nytt år: flytta mellan årslistorna
      const old = x.y;
      x.y = +v;
      pl.sort((a, c) => a.y - c.y);
      setPl(g, pl, L => { if (!pl.some(z => z.y === old)) dropFromYear(L, g.id, old); addToYear(L, g.id, x.y); });
    }
  }
  if (act === 'note') {
    const v = t.value.trim();
    if (v === (g.note || '')) return;
    // Sparas utan omritning, så att ett tryck direkt efter (t.ex. på en stjärna) inte tappas.
    PATCH.g[g.id] = Object.assign(PATCH.g[g.id] || {}, { note: v, t: Date.now() });
    lsSet('st_patch_v1', PATCH);
    rebuild();
    syncSoon();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') {
    UI.q = e.target.value;
    if (UI.tab === 'search') igdbSearch(UI.q);
    renderBody();
  }
});
document.addEventListener('keydown', e => {
  // "/" = sök (om man inte redan skriver någonstans)
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName) && !UI.game) {
    e.preventDefault();
    if (!(isDesk() && UI.tab === 'lib')) go({ tab: 'search' }, true);
    const q = $('#q');
    if (q) q.focus();
    return;
  }
  if (e.key !== 'Escape') return;
  if (UI.big) { UI.big = false; renderGame(); }
  else if (UI.game) closeGame();
  else if (UI.sheet) { UI.sheet = false; renderSheet(); }
});
matchMedia('(min-width:900px)').addEventListener('change', () => { lastHead = ''; render(); });

// iOS: efter att tangentbordet stängts kan fasta element (flikraden) hamna fel tills sidan ritas om.
document.addEventListener('focusout', e => {
  if (!e.target.matches('input,textarea')) return;
  setTimeout(() => {
    window.scrollTo(window.scrollX, window.scrollY);
    const t = $('#tabs');
    t.style.display = 'none';
    void t.offsetHeight;
    t.style.display = '';
  }, 60);
});

// ---------- Ändra ordning i lista: dra i handtaget ----------
let drag = null;
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('.grip');
  if (!h) return;
  e.preventDefault();
  const row = h.closest('.ror');
  drag = { row, box: row.parentNode };
  row.classList.add('drag');
  try { h.setPointerCapture(e.pointerId); } catch (err) { }
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  e.preventDefault();
  let before = null;   // raden som den dragna ska hamna före
  for (const r of drag.box.children) {
    if (r === drag.row) continue;
    const rc = r.getBoundingClientRect();
    if (e.clientY < rc.top + rc.height / 2) { before = r; break; }
  }
  if (drag.row.nextSibling !== before) drag.box.insertBefore(drag.row, before);
  if (e.clientY < 90) scrollBy(0, -14);
  else if (e.clientY > innerHeight - 140) scrollBy(0, 14);
}, { passive: false });
function endDrag() {
  if (!drag) return;
  const ids = [...drag.box.children].map(r => r.dataset.id), lid = UI.reorder;
  drag = null;
  editLists(L => {
    const l = L.find(x => x.id === lid);
    if (l) l.ids = ids.concat(l.ids.filter(id => !ids.includes(id)));
  });
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// Liten rubrik överst när den stora har skrollats bort (mobil). Tryck = till toppen.
addEventListener('scroll', () => {
  document.body.classList.toggle('scrolled', !isDesk() && scrollY > 60);
}, { passive: true });
