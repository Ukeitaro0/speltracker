'use strict';
// Data: konstanter, hjälpfunktioner och biblioteksmodellen.
//
// Modell:  BASE  = data/library.json (grundfilen i repot)
//          PATCH = lokala ändringar i localStorage (st_patch_v1), läggs ovanpå BASE
//          GAMES/GM/LISTS = resultatet efter rebuild(), det som allt ritas från.
// Ändringar görs alltid via setGame()/editLists() som sparar, bygger om och ritar om.

// ---------- Konstanter ----------
const ST = [
  { id: 'playing', label: 'Spelar', c: '#A8E6CF' },
  { id: 'replaying', label: 'Spelar om', c: '#C9B8FF' },
  { id: 'paused', label: 'Pausat', c: '#FFC9A8' },
  { id: 'backlog', label: 'Backlog', c: '#B8C4D9' },
  { id: 'wishlist', label: 'Wishlist', c: '#FFE3A3' },
  { id: 'played', label: 'Klarat', c: '#8FD3F4' },
  { id: 'abandoned', label: 'Gett upp', c: '#F4A9B8' }
];
const SM = Object.fromEntries(ST.map(s => [s.id, s]));

const PLAT = [
  { id: 'steam', label: 'Steam', short: 'Steam' },
  { id: 'ps', label: 'PlayStation', short: 'PS' },
  { id: 'xbox', label: 'Xbox', short: 'Xbox' },
  { id: 'ios', label: 'iOS', short: 'iOS' },
  { id: 'other', label: 'Annan plattform', short: 'Annan' }
];
const platLabel = id => (PLAT.find(p => p.id === id) || {}).label || id;

// Utfall för en genomspelning ('' = pågår)
const OUT = {
  played: { label: 'Klarat', c: '#8FD3F4' },
  abandoned: { label: 'Gett upp', c: '#F4A9B8' },
  '': { label: 'Pågår', c: '#4E6B60' }
};

const COVERS = ['#3F5A52', '#4A4A6E', '#5C4A5E', '#6A5340', '#3E5A6E', '#5A5E3C',
  '#6A4450', '#40604A', '#55506A', '#4A5A66', '#6A5A46', '#3F5F62'];
const RATE = ['', 'Dåligt', 'Sådär', 'Bra', 'Riktigt bra', 'Kanonspel!'];
const SORTS = [['add', 'Senast tillagd'], ['name', 'Namn'], ['rating', 'Betyg'],
  ['cr', 'Kritikerbetyg'], ['rel', 'Utgivning']];
const NOWY = new Date().getFullYear();
const YEAR_LIST = /^played (\d{4})$/i;   // årslistor heter "played 2025"
const IGDB_IMG = 'https://images.igdb.com/igdb/image/upload/';

// ---------- Små hjälpare ----------
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (id, size) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const rgba = (h, o) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${o})`;
};
const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const dec = n => n.toFixed(1).replace('.', ',');
const isDesk = () => matchMedia('(min-width:900px)').matches;
const attr = (cond, text) => cond ? ' ' + text : '';   // villkorligt HTML-attribut

function ls(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

// ---------- Tillstånd ----------
let BASE = { games: [], lists: [] };
let PATCH = ls('st_patch_v1', null) || { g: {}, add: [], del: {}, lists: null };
let V = Object.assign({ f: 'all', sort: 'add' }, ls('st_view_v1', {}));   // sparad vy (filter, sortering)
const UI = {                       // tillfälligt läge i gränssnittet
  tab: 'lib', q: '', game: null, sheet: false, wipe: 0,
  so: false, lo: false, oo: false, po: false,   // öppna delar på spelkortet
  reorder: null, year: null, big: false
};
let GAMES = [], GM = {}, LISTS = [];

function setView(o) { Object.assign(V, o); lsSet('st_view_v1', V); }

// ---------- Bygga biblioteket ----------
const PATCH_KEYS = ['s', 'r', 'p', 'note', 'pl'];
const EMPTY = { note: '', pl: [] };

// Tar bort lokala ändringar som redan finns i grundfilen (efter att Claude slagit ihop dem).
function prune() {
  const pg = PATCH.g || {};
  let n = 0;
  BASE.games.forEach(b => {
    const f = pg[b.id];
    if (!f) return;
    PATCH_KEYS.forEach(k => {
      const base = b[k] === undefined ? (k in EMPTY ? EMPTY[k] : null) : b[k];
      if (k in f && JSON.stringify(f[k]) === JSON.stringify(base)) { delete f[k]; n++; }
    });
    if (!PATCH_KEYS.some(k => k in f)) delete pg[b.id];
  });
  if (n) lsSet('st_patch_v1', PATCH);
}

function rebuild() {
  const del = PATCH.del || {}, pg = PATCH.g || {};
  GAMES = BASE.games.concat(PATCH.add || []).filter(g => !del[g.id]).map(g => {
    const m = Object.assign({}, g, pg[g.id] || {});
    if (pg[g.id] && 's' in pg[g.id]) delete m.cf;
    return m;
  });
  GM = {};
  GAMES.forEach(g => { GM[g.id] = g; });
  LISTS = (PATCH.lists || BASE.lists).map(l => ({ id: l.id, name: l.name, ids: l.ids.filter(id => GM[id]) }));
}

function save() { lsSet('st_patch_v1', PATCH); rebuild(); render(); }
function setGame(id, fields) {
  PATCH.g[id] = Object.assign(PATCH.g[id] || {}, fields, { t: Date.now() });
  save();
}
// Ändra listorna utan att spara (används när en annan ändring sparar strax efter).
function withLists(fn) {
  const L = JSON.parse(JSON.stringify(PATCH.lists || BASE.lists));
  fn(L);
  PATCH.lists = L;
  PATCH.lt = Date.now();
}
function editLists(fn) { withLists(fn); save(); }

// ---------- Genomspelningar ----------
// g.pl = [{y: år, p: plattform, o: 'played' | 'abandoned' | null (pågår)}], äldst först.
// Spelet läggs automatiskt sist i listan "played ÅÅÅÅ" för året (som skapas vid behov).
function yearList(L, y) {
  return L.find(l => { const m = l.name.match(YEAR_LIST); return m && +m[1] === +y; });
}
function addToYear(L, gid, y) {
  let l = yearList(L, y);
  if (!l) { l = { id: 'l' + Date.now() + y, name: 'played ' + y, ids: [] }; L.push(l); }
  if (!l.ids.includes(gid)) l.ids.push(gid);
}
function dropFromYear(L, gid, y) {
  const l = yearList(L, y);
  if (l) l.ids = l.ids.filter(x => x !== gid);
}
function plCopy(g) { return (g.pl || []).map(x => Object.assign({}, x)); }
function setPl(g, pl, listFn) { if (listFn) withLists(listFn); setGame(g.id, { pl }); }

// Ny status → genomspelningarna följer med automatiskt (se CLAUDE.md, "Automatiska årtal").
function setStatus(g, s) {
  const pl = plCopy(g), last = pl[pl.length - 1];
  const done = x => x === 'played' || x === 'abandoned';
  let y = 0, msg = '';
  if (s === 'playing' || s === 'replaying') {
    if (!last || last.o) { pl.push({ y: NOWY, p: g.p || null, o: null }); y = NOWY; }
  } else if (done(s)) {
    if (last && !last.o) { last.o = s; last.y = NOWY; y = NOWY; }      // avsluta pågående
    else if (last) last.o = s;                                        // rätta utfallet
    else if (!done(g.s)) {                                            // ingen genomspelning alls
      pl.push({ y: NOWY, p: g.p || null, o: s }); y = NOWY;
      msg = 'Genomspelning ' + NOWY + ' tillagd. Året går att ändra under Genomspelningar.';
    }
  }
  if (y) withLists(L => addToYear(L, g.id, y));
  setGame(g.id, { s, pl });
  if (msg) toast(msg);
}

// Plattformsval gäller senaste genomspelningen om den pågår, är från i år eller saknar plattform.
function setPlatform(g, p) {
  const f = { p }, pl = plCopy(g), last = pl[pl.length - 1];
  if (last && (!last.o || last.y === NOWY || !last.p)) { last.p = p; f.pl = pl; }
  setGame(g.id, f);
}

// Alla plattformar spelet spelats på: aktuell först, sedan tidigare genomspelningar.
function plats(g) {
  const a = [];
  [g.p].concat((g.pl || []).slice().reverse().map(x => x.p))
    .forEach(p => { if (p && !a.includes(p)) a.push(p); });
  return a;
}

// ---------- Urval och sortering ----------
function year(g) { return (g.rel || '').slice(0, 4); }
function cmpName(a, b) { return a.n.localeCompare(b.n, 'sv'); }
function sortGames(arr) {
  const s = V.sort;
  const by = {
    name: (a, b) => cmpName(a, b),
    rating: (a, b) => (b.r - a.r) || cmpName(a, b),
    cr: (a, b) => ((b.cr || 0) - (a.cr || 0)) || cmpName(a, b),
    rel: (a, b) => (b.rel || '').localeCompare(a.rel || '') || cmpName(a, b),
    add: (a, b) => (b.add || '').localeCompare(a.add || '') || cmpName(a, b)
  };
  return arr.slice().sort(by[s] || by.add);
}
// Det som biblioteksvyn visar just nu (V.f = all | s:<status> | l:<lista> | noplat | cf).
function current() {
  const f = V.f;
  if (f.startsWith('s:') && SM[f.slice(2)]) {
    const s = SM[f.slice(2)];
    return { arr: sortGames(GAMES.filter(g => g.s === s.id)), title: s.label, dot: s.c };
  }
  if (f.startsWith('l:')) {
    const l = LISTS.find(x => x.id === f.slice(2));
    if (l) return { arr: l.ids.map(id => GM[id]), title: l.name, list: l };
  }
  if (f === 'noplat') return { arr: sortGames(GAMES.filter(g => !g.p)), title: 'Saknar plattform' };
  if (f === 'cf') return { arr: sortGames(GAMES.filter(g => g.cf)), title: 'Kolla status' };
  if (f !== 'all') setView({ f: 'all' });
  return { arr: sortGames(GAMES), title: 'Alla spel' };
}
function searchHits(q) {
  const n = norm(q);
  return n ? sortGames(GAMES.filter(g => norm(g.n).includes(n))).slice(0, 80) : [];
}
