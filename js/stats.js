'use strict';
// Statistikfliken: översikt (statsBody) och årsvy (yearBody). Anropas från renderBody() i views.js.
// Bygger på genomspelningarna (g.pl): ett spel räknas till ett år om det har en genomspelning det året.

const PLAT_COLORS = ['#B5E3C8', '#7FB89C', '#5E8F7C', '#9DB0A8', '#4E6B60'];
const genreName = n => n.replace('Role-playing (RPG)', 'RPG').replace(/^Platform$/, 'Plattform');
const famsOf = g => [...new Set(plats(g).map(famOf))];
// "PS5 8 · PS4 3" – modeller (inte bara familj) bland plattforms-id:n
function modelLine(ids) {
  const m = tally(ids.filter(p => p && p !== famOf(p)));
  return m.length ? `<span class="mute" style="font-size:13px">${m.map(([p, n]) => esc(platLabel(p)) + ' ' + n).join(' · ')}</span>` : '';
}

// { år: { spelId: {g, o: utfall ('' = pågår), p: plattform} } }
function yearMap() {
  const Y = {};
  GAMES.forEach(g => (g.pl || []).forEach(x => {
    (Y[x.y] = Y[x.y] || {})[g.id] = { g, o: x.o || '', p: x.p || g.p };
  }));
  return Y;
}
// Räknar förekomster, störst först: [[värde, antal], ...]
function tally(arr) {
  const c = {};
  arr.forEach(k => { if (k) c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function avgRating(gs) {
  const r = gs.filter(g => g.r);
  return r.length ? dec(r.reduce((a, g) => a + g.r, 0) / r.length) : '–';
}
const pct = (k, u) => k + u ? Math.round(k / (k + u) * 100) + ' %' : '–';

// ---------- Diagram (parts = [[etikett, antal, färg], ...]) ----------
function stack(parts) {
  return `<div class="stack">${parts.filter(x => x[1])
    .map(x => `<span style="flex:${x[1]} 0 0;background:${x[2]}"></span>`).join('')}</div>`;
}
function legend(parts) {   // antal '' = visa bara etiketten
  return `<div class="leg">${parts.filter(x => x[1] !== 0)
    .map(x => `<span><i style="background:${x[2]}"></i>${esc(x[0])}${x[1] === '' ? '' : ' ' + x[1]}</span>`).join('')}</div>`;
}
const stackWithLegend = parts => stack(parts) + legend(parts);
function hbars(rows) {
  const max = Math.max(1, ...rows.map(x => x[1]));
  return rows.map(([label, n]) => `<div class="hb">
      <span>${esc(label)}</span>
      <span class="t"><i style="width:${Math.max(2, Math.round(n / max * 100))}%"></i></span>
      <b>${n}</b></div>`).join('');
}
const tile = (value, label, color) => `<div class="tile"><b${color ? ` style="color:${color}"` : ''}>${value}</b><span>${label}</span></div>`;
const scard = (title, body, small) => `<div class="scard"><h2>${title}${small ? ` <small>${small}</small>` : ''}</h2>${body}</div>`;
const outcomeParts = (k, u, o) => [['Klarat', k, OUT.played.c], ['Gett upp', u, OUT.abandoned.c], ['Pågår / annat', o, OUT[''].c]];

// ---------- Översikt ----------
function yearColumns(Y) {
  const ys = Object.keys(Y).map(Number).sort((a, b) => a - b);
  if (!ys.length) return '<span class="mute">Inga genomspelningar än.</span>';
  const count = y => {
    const v = Object.values(Y[y]);
    return [v.filter(x => x.o === 'played').length, v.filter(x => x.o === 'abandoned').length, v.filter(x => !x.o).length];
  };
  const max = Math.max(1, ...ys.map(y => count(y).reduce((a, b) => a + b, 0)));
  const col = y => {
    const [k, u, o] = count(y), total = k + u + o;
    const segs = [[o, OUT[''].c], [u, OUT.abandoned.c], [k, OUT.played.c]].filter(x => x[0])
      .map(x => `<span style="flex:${x[0]} 0 0;background:${x[1]}"></span>`).join('');
    return `<button class="ycol" data-act="year" data-y="${y}" aria-label="${y}: ${total} spel">
        <small>${total}</small>
        <span class="yb" style="height:${Math.round(total / max * 120)}px">${segs}</span>
        <span class="yl"${y === NOWY ? ' style="color:var(--text);font-weight:700"' : ''}>'${String(y).slice(2)}</span>
      </button>`;
  };
  return `<div class="ycols">${ys.map(col).join('')}</div>` + legend(outcomeParts('', '', ''));
}
function statsBody() {
  const k = GAMES.filter(g => g.s === 'played').length, u = GAMES.filter(g => g.s === 'abandoned').length;
  const status = ST.map(s => [s.label, GAMES.filter(g => g.s === s.id).length, s.c]).sort((a, b) => b[1] - a[1]);
  const platRows = tally([].concat(...GAMES.map(famsOf))).map(([f, n]) => [famLabel(f), n]);
  const noPlat = GAMES.filter(g => !plats(g).length).length;
  const genres = tally([].concat(...GAMES.map(g => g.gen || []))).slice(0, 6).map(([n, c]) => [genreName(n), c]);
  return `<div class="stats">
    <div class="tiles">
      ${tile(GAMES.length, 'spel i biblioteket')}
      ${tile(k, 'klarade', OUT.played.c)}
      ${tile(pct(k, u), 'completion rate', 'var(--acc)')}
      ${tile(avgRating(GAMES) + ' ★', 'ditt snittbetyg', 'var(--star)')}
    </div>
    ${scard('Spelat per år', yearColumns(yearMap()), 'tryck på ett år')}
    ${scard('Status', stackWithLegend(status))}
    ${scard('Plattform', hbars(platRows) + `<span class="mute" style="font-size:13px">${noPlat} spel saknar plattform</span>`)}
    ${scard('Genre', hbars(genres), 'topp 6')}
  </div>`;
}

// ---------- Årsvy ----------
function miniGrid(items) {   // items = [{g, dot: färg, label}]
  return `<div class="mini">${items.map(({ g, dot: c, label }) => `
    <button class="card" data-act="game" data-id="${g.id}" aria-label="${esc(g.n)}, ${label}">
      ${cover(g, `<span class="ct">${esc(g.n)}</span><i class="od" style="background:${c}"></i>`)}
    </button>`).join('')}</div>`;
}
function top3(games) {
  return `<div class="top3">${games.map((g, i) => `
    <button class="card" data-act="game" data-id="${g.id}">
      ${cover(g, `<span class="ctop"><span></span><span class="rank">${i + 1}</span></span><span class="ct">${esc(g.n)}</span>`)}
      <span class="nm" style="font-size:12px">${esc(g.n)}</span>
      <span class="meta"><span class="stars">${stars(g.r)}</span></span>
    </button>`).join('')}</div>`;
}
function yearBody(y) {
  const Y = yearMap(), M = Y[y] || {}, L = yearList(LISTS, y);
  // Ordning: som i årslistan, sedan övriga efter betyg.
  const ranked = L ? L.ids.filter(id => M[id]) : [];
  const rest = Object.keys(M).filter(id => !ranked.includes(id))
    .sort((a, b) => (GM[b].r - GM[a].r) || cmpName(GM[a], GM[b]));
  const E = ranked.concat(rest).map(id => M[id]), gs = E.map(x => x.g);

  const k = E.filter(x => x.o === 'played').length, u = E.filter(x => x.o === 'abandoned').length;
  const top = (L ? L.ids.filter(id => GM[id]) : ranked.concat(rest)).slice(0, 3).map(id => GM[id]);
  const relYears = gs.map(g => +year(g) || 0);
  const same = relYears.filter(r => r === y).length, older = relYears.filter(r => r && r < y).length;
  const oldest = gs.filter(g => +year(g)).sort((a, b) => (a.rel || '').localeCompare(b.rel || ''))[0];
  const platParts = tally(E.map(x => x.p && famOf(x.p))).map(([f, n], i) => [famLabel(f), n, PLAT_COLORS[i % PLAT_COLORS.length]]);
  const noPlat = E.filter(x => !x.p).length;
  if (noPlat) platParts.push(['Okänd', noPlat, '#33423C']);
  const genres = tally([].concat(...gs.map(g => g.gen || []))).slice(0, 4);
  const years = Object.keys(Y).map(Number).sort((a, b) => b - a);
  // Utgivna det året som ligger kvar på Wishlist/Backlog (och inte spelats det året)
  const waiting = GAMES.filter(g => +year(g) === y && (g.s === 'wishlist' || g.s === 'backlog') && !M[g.id])
    .sort((a, b) => (a.s === b.s ? 0 : a.s === 'backlog' ? -1 : 1) || cmpName(a, b));

  return `<div class="stats">
    <div class="ychips">${years.map(x => `<button class="${x === y ? 'on' : ''}" data-act="year" data-y="${x}">${x}</button>`).join('')}</div>
    <div class="big"><b>${E.length}</b><span>spel spelade</span></div>
    <div class="tiles kpis">
      ${tile(pct(k, u), 'klarade', 'var(--acc)')}
      ${tile(avgRating(gs) + ' ★', 'snittbetyg', 'var(--star)')}
      ${tile(gs.filter(g => g.r === 5).length, 'femstjärniga', OUT.played.c)}
    </div>
    ${scard('Completion rate', stackWithLegend(outcomeParts(k, u, E.length - k - u)), `${k} av ${k + u} avgjorda`)}
    ${top.length ? scard('Årets topp 3', top3(top), L ? 'från listan ' + esc(L.name) : 'efter ditt betyg') : ''}
    ${scard('Nya eller äldre', stackWithLegend([['Från ' + y, same, '#B5E3C8'], ['Äldre', older, '#5E8F7C']])
      + (oldest ? `<span class="mute" style="font-size:13px">Äldst: ${esc(oldest.n)} (${year(oldest)})</span>` : ''))}
    ${scard('Plattform', stackWithLegend(platParts) + modelLine(E.map(x => x.p)))}
    ${genres.length ? scard('Mest spelade genrer',
      `<div class="gch">${genres.map(([n, c]) => `<span>${esc(genreName(n))} <i>${c}</i></span>`).join('')}</div>`) : ''}
    <div class="scard plain"><h2>Alla spel ${y}</h2>
      ${miniGrid(E.map(x => ({ g: x.g, dot: OUT[x.o].c, label: OUT[x.o].label })))}</div>
    ${waiting.length ? `<div class="scard plain"><h2>Släppt ${y} – ligger kvar <small>${waiting.length} på Backlog/Wishlist</small></h2>
      ${miniGrid(waiting.map(g => ({ g, dot: SM[g.s].c, label: SM[g.s].label })))}
      ${legend([['Backlog', '', SM.backlog.c], ['Wishlist', '', SM.wishlist.c]])}</div>` : ''}
  </div>`;
}
