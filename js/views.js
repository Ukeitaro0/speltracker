'use strict';
// Vyer: allt som ritar HTML. Varje render*-funktion ritar om sin del helt utifrån GAMES/LISTS/UI.

// ---------- Byggstenar ----------
function scoreColor(n) { return n >= 75 ? '#A8E6CF' : n >= 50 ? '#FFE3A3' : '#F4A9B8'; }
function coverColor(g) {
  let h = 0;
  for (const ch of g.n) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return COVERS[Math.abs(h) % COVERS.length];
}
// Omslag med färgruta + titel som reserv om bilden saknas eller inte laddar.
function cover(g, inner = '', size = 't_cover_big') {
  const img = g.cov
    ? `<img class="ci" src="${IGDB_IMG}${size}/${g.cov}.jpg" alt="" loading="lazy"
        onerror="this.parentNode.classList.remove('has');this.remove()">`
    : '';
  return `<span class="cover${g.cov ? ' has' : ''}" style="background:${coverColor(g)}">${img}${inner}</span>`;
}
function stars(r) { return r ? '★'.repeat(r) + '<i>' + '★'.repeat(5 - r) + '</i>' : '<i>★★★★★</i>'; }
const dot = (c, size) => `<span class="dot" style="background:${c}${size ? `;width:${size}px;height:${size}px` : ''}"></span>`;
const chev = n => `<span class="mute">${ico('chev', n || 16)}</span>`;
const options = (items, selected) => items
  .map(([v, label]) => `<option value="${v}"${attr(v === selected, 'selected')}>${esc(label)}</option>`).join('');

// Spelruta i rutnätet
function card(g, rank) {
  const s = SM[g.s] || SM.backlog;
  const critic = g.cr
    ? `<span class="sc" style="color:${scoreColor(g.cr)};background:${rgba(scoreColor(g.cr), .14)}" title="Kritikerbetyg (IGDB)">${g.cr}</span>`
    : '';
  return `<button class="card" data-act="game" data-id="${g.id}">
    ${cover(g, `
      <span class="ctop"><span class="pill" style="background:${s.c}">${s.label}</span>${rank ? `<span class="rank">${rank}</span>` : ''}</span>
      <span class="ct">${esc(g.n)}</span>`)}
    <span class="nm">${esc(g.n)}</span>
    <span class="meta">
      <span class="stars"${g.r ? ` title="${RATE[g.r]}"` : ''}>${stars(g.r)}</span>
      <span class="mr">${critic}${[...new Set(plats(g).map(p => platInfo(p).icon))].slice(0, 3).map(x => ico(x, 16)).join('')}</span>
    </span>
  </button>`;
}

// ---------- Navigering (sidomeny på dator, ark på mobil, flikrad) ----------
function navRows() {
  const row = (f, label, n, color) => {
    const on = V.f === f && UI.tab === 'lib' && !UI.q;
    return `<button class="nrow${on ? ' on' : ''}" data-act="filter" data-f="${f}">
      <span class="nl">${color ? dot(color) : ''}<span>${esc(label)}</span></span><span class="nc">${n}</span></button>`;
  };
  const count = id => GAMES.filter(g => g.s === id).length;
  return `<div class="sect">Kategorier</div>
    <div class="rows">
      ${row('all', 'Alla spel', GAMES.length, '#EAF2EE')}
      ${ST.map(s => row('s:' + s.id, s.label, count(s.id), s.c)).join('')}
    </div>
    <div class="sect">Listor</div>
    <div class="rows">
      ${LISTS.map(l => row('l:' + l.id, l.name, l.ids.length)).join('')}
      <button class="nrow add" data-act="newlist"><span class="nl">${ico('plus', 18)}<span>Ny lista</span></span></button>
    </div>`;
}
function renderSide() {
  const tabRow = (tab, label, icon) => `<button class="nrow${UI.tab === tab ? ' on' : ''}" data-act="tab" data-tab="${tab}">
      <span class="nl">${icon ? ico(icon, 18) : ''}<span>${label}</span></span></button>`;
  $('#side').innerHTML = `<div class="brand">Speltracker</div>
    ${navRows()}
    <div class="foot">${tabRow('stats', 'Statistik', 'stats')}${tabRow('more', 'Mer och inställningar')}</div>`;
}
function renderSheet() {
  const el = $('#sheet');
  el.className = UI.sheet ? 'open' : '';
  el.innerHTML = UI.sheet
    ? `<div class="backdrop" data-act="sheetclose"></div><div class="sheetp"><div class="handle"></div>${navRows()}</div>`
    : '';
}
function renderTabs() {
  const tab = (id, label) => `<button class="${UI.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${ico(id, 22)}${label}</button>`;
  $('#tabs').innerHTML = tab('lib', 'Bibliotek') + tab('lists', 'Listor') + tab('search', 'Sök')
    + tab('stats', 'Statistik') + tab('more', 'Mer');
}

// ---------- Rubrik ----------
let lastHead = '';   // rubriken ritas bara om när den ändras, så att sökfältet behåller fokus
function renderHead() {
  const back = depth() > 0 ? `<button class="icon back" data-act="back" aria-label="Tillbaka">${ico('back', 24)}</button>` : '';
  const title = t => `<div class="lhead"><span class="tl">${back}<span class="h1">${t}</span></span></div>`;
  let h;
  if (UI.tab === 'lib') {
    const c = current();
    h = `<div class="lhead">
        ${back}<button class="ttl" data-act="sheet">${c.dot ? dot(c.dot) : ''}<h1>${esc(c.title)}</h1><span class="chev">${ico('chev', 20)}</span></button>
        <div class="dhead">
          <label class="search">${ico('search', 18)}<input id="q" type="search" placeholder="Sök i biblioteket" aria-label="Sök i biblioteket" autocomplete="off"></label>
          <button class="addb" data-act="tab" data-tab="search" aria-label="Lägg till spel">${ico('plus', 22)}</button>
        </div>
      </div>
      <div class="sub" id="sub"></div>`;
  } else if (UI.tab === 'search') {
    h = title('Sök') + `<label class="search" style="margin-bottom:18px">${ico('search', 18)}
      <input id="q" type="search" placeholder="Spelets namn" aria-label="Sök spel" autocomplete="off"></label>`;
  } else if (UI.tab === 'stats' && UI.year) {
    h = title('Ditt ' + UI.year);
  } else {
    h = title({ lists: 'Listor', stats: 'Statistik', more: 'Mer' }[UI.tab]);
  }
  if (h !== lastHead) {
    $('#mhead').innerHTML = h;
    lastHead = h;
    const q = $('#q');
    if (q) q.value = UI.q;
  }
}
// Raden under rubriken: antal + sortering, eller listans knappar.
function renderSub(c) {
  const el = $('#sub');
  if (!el) return;
  const link = (act, text, style) => `<button class="lnk" data-act="${act}"${style ? ` style="${style}"` : ''}>${text}</button>`;
  if (UI.q && isDesk()) el.innerHTML = `${searchHits(UI.q).length} träffar`;
  else if (c.list && UI.reorder === c.list.id)
    el.innerHTML = `Dra i <span style="display:inline-flex;vertical-align:middle">${ico('grip', 16)}</span> för att flytta
      ${link('reorderdone', 'Klar', 'font-weight:600')}`;
  else if (c.fixed)
    el.innerHTML = `${c.fixed === 'serie' ? 'Serie' : 'Utvecklare'} · ${c.arr.length} spel · utgivningsordning`;
  else if (c.list)
    el.innerHTML = `${c.arr.length} spel · listordning
      ${link('reorder', 'Ändra ordning')}${link('renamelist', 'Byt namn')}${link('dellist', 'Ta bort lista')}`;
  else
    el.innerHTML = `${c.arr.length} spel · <select data-act="sort" aria-label="Sortering">${options(SORTS, V.sort)}</select>`;
}

// ---------- Innehåll per flik ----------
const grid = gs => `<div class="grid">${gs.join('')}</div>`;

function searchBody() {
  if (!UI.q) return `<div class="empty">Sök bland dina ${GAMES.length} spel.<br>Sökning i IGDB (med omslag) kommer när nyckeln är på plats.</div>`;
  const hits = searchHits(UI.q);
  return (hits.length ? grid(hits.map(g => card(g))) : `<div class="empty">Inget spel i biblioteket heter så.</div>`)
    + `<button class="manual" data-act="addman">Lägg till ”${esc(UI.q)}” för hand</button>`;
}
function reorderBody(c) {
  return `<div class="ro" id="ro">${c.arr.map((g, i) => `
    <div class="ror" data-id="${g.id}">
      <span class="rn">${i + 1}</span>
      <span class="rc" style="background:${coverColor(g)}">${g.cov ? `<img src="${IGDB_IMG}t_cover_small/${g.cov}.jpg" alt="" loading="lazy">` : ''}</span>
      <span class="rt">${esc(g.n)}</span>
      <button class="grip" aria-label="Flytta ${esc(g.n)}">${ico('grip', 22)}</button>
    </div>`).join('')}</div>`;
}
function libBody() {
  const c = current();
  renderSub(c);
  if (UI.q && isDesk()) return searchBody();
  if (c.list && UI.reorder === c.list.id) return reorderBody(c);
  return c.arr.length ? grid(c.arr.map((g, i) => card(g, c.list ? i + 1 : 0))) : `<div class="empty">Inga spel här än.</div>`;
}
function listsBody() {
  return `<div class="panel rows">
    ${LISTS.map(l => `<button class="nrow" data-act="filter" data-f="l:${l.id}">
      <span class="nl"><span>${esc(l.name)}</span></span><span class="nc">${l.ids.length}</span></button>`).join('')}
    <button class="nrow add" data-act="newlist"><span class="nl">${ico('plus', 18)}<span>Ny lista</span></span></button>
  </div>`;
}
function moreBody() {
  const row = (act, label, n, extra = '') => `<button class="nrow" data-act="${act}"${extra}>
      <span class="nl"><span>${label}</span></span>${n === undefined ? '' : `<span class="nc">${n}</span>`}</button>`;
  const changed = Object.keys(PATCH.g || {}).length + (PATCH.add || []).length
    + Object.keys(PATCH.del || {}).length + (PATCH.lists ? 1 : 0);
  const wipe = `<span style="color:#F4A9B8">${UI.wipe ? 'Tryck igen för att slänga' : 'Släng lokala ändringar'}</span>`;
  return `<div class="panel rows">
      ${row('filter', 'Saknar plattform', GAMES.filter(g => !g.p).length, ' data-f="noplat"')}
      ${row('filter', 'Kolla status (låg på flera hyllor i Grouvee)', GAMES.filter(g => g.cf).length, ' data-f="cf"')}
    </div>
    <div class="sect">Ändringar på den här enheten</div>
    <div class="panel rows">
      ${row('export', 'Kopiera ändringar', changed)}
      ${row('wipe', wipe)}
    </div>
    <div class="info">${BASE.games.length} spel från Grouvee${BASE.exported ? ' (export ' + esc(BASE.exported.slice(0, 10)) + ')' : ''}.<br>
      Ändringar sparas bara på den här enheten tills servern finns. Kopiera dem och klistra in i chatten med Claude så hamnar de i grundfilen.<br>
      Version ${BUILD}</div>`;
}
function renderBody() {
  const body = {
    lib: libBody,
    search: searchBody,
    lists: listsBody,
    stats: () => UI.year ? yearBody(UI.year) : statsBody(),   // stats.js
    more: moreBody
  }[UI.tab] || libBody;
  $('#mbody').innerHTML = body();
}

// ---------- Spelkortet ----------
function statusPart(g, s) {
  const head = `<button class="row" data-act="so"><span>Status</span>
    <span class="rv">${dot(s.c, 10)}<span style="color:${s.c}">${s.label}</span>${chev()}</span></button>`;
  if (!UI.so) return head;
  return head + `<div class="opts">${ST.map(x => `
    <button class="opt" data-act="status" data-s="${x.id}"${x.id === g.s ? ` style="background:${rgba(x.c, .14)}"` : ''}>
      <span class="nl">${dot(x.c, 10)}${x.label}</span>
      ${x.id === g.s ? `<span style="color:var(--acc)">${ico('check', 18)}</span>` : ''}
    </button>`).join('')}</div>`;
}
function ratingPart(g) {
  const ext = [['IGDB', g.cr], ['User', g.ur]].filter(x => x[1])
    .map(([l, n]) => `${l} <b style="color:${scoreColor(n)}">${n}</b>`).join(' · ');
  const starBtns = [1, 2, 3, 4, 5].map(n => `<button data-act="rate" data-n="${n}" aria-label="${n} av 5, ${RATE[n]}"
      title="${RATE[n]}" class="${n <= g.r ? 'on' : ''}">★</button>`).join('');
  return `<div class="row">
    <span class="rl">Betyg<small>${g.r ? RATE[g.r] : 'Inget betyg än'}</small>${ext ? `<small class="ext">${ext}</small>` : ''}</span>
    <span class="sbig">${starBtns}</span></div>`;
}
// Familjeknappar + (om vald familj har modeller) en rad med modeller under.
function platformPart(g) {
  const cur = g.p ? famOf(g.p) : null, earlier = plats(g).map(famOf);
  const fams = FAMS.concat(cur === 'other' ? [{ id: 'other', label: 'Annan plattform', models: [] }] : []);
  const btn = f => {
    const on = cur === f.id, was = !on && earlier.includes(f.id);   // was = spelat där tidigare
    return `<button data-act="plat" data-p="${f.id}" aria-label="${f.label}" aria-pressed="${on}"
      class="${on ? 'on' : was ? 'was' : ''}"${was ? ' title="Spelat tidigare"' : ''}>${ico(f.id, 20)}</button>`;
  };
  const fam = FAMS.find(f => f.id === cur);
  const models = fam && fam.models.length ? `<div class="pmods">${fam.models.map(([id, short]) =>
    `<button class="chip${g.p === id ? ' on' : ''}" data-act="platm" data-p="${id}">${short}</button>`).join('')}</div>` : '';
  return `<div class="row"><span>Plattform</span><span class="plats">${fams.map(btn).join('')}</span></div>${models}`;
}
// Rullgardin med familjer och modeller i grupper.
function platSelect(i, value) {
  const opt = (id, label) => `<option value="${id}"${attr(id === value, 'selected')}>${label}</option>`;
  const extra = value && !PLATS[value] || value === 'other' ? opt(value, platLabel(value)) : '';
  return `<select data-act="plp" data-i="${i}" aria-label="Plattform">${opt('', '–')}${extra}
    ${FAMS.map(f => f.models.length
      ? `<optgroup label="${f.label}">${opt(f.id, f.label + ' (okänd)')}${f.models.map(([id]) => opt(id, platLabel(id))).join('')}</optgroup>`
      : opt(f.id, f.label)).join('')}</select>`;
}
function playthroughPart(g) {
  const pl = g.pl || [];
  const head = `<button class="row" data-act="po"><span>Genomspelningar</span>
    <span class="rv mute">${pl.length ? pl.map(x => x.y).join(', ') : 'Inga'} ${ico('chev', 16)}</span></button>`;
  if (!UI.po) return head;
  const years = Array.from({ length: NOWY - 1979 }, (_, k) => NOWY - k).map(v => [v, v]);
  const row = (x, i) => `<div class="plr">
      <select data-act="ply" data-i="${i}" aria-label="År">${options(years, x.y)}</select>
      ${platSelect(i, x.p || '')}
      <select data-act="plo" data-i="${i}" aria-label="Utfall">${options([['', x.y < NOWY ? 'Fortsatte' : 'Pågår'],
        ['played', OUT.played.label], ['abandoned', OUT.abandoned.label]], x.o || '')}</select>
      <button class="plx" data-act="pldel" data-i="${i}" aria-label="Ta bort genomspelningen ${x.y}">${ico('x', 18)}</button>
    </div>`;
  return head + `<div class="pls">${pl.map(row).join('')}
    <button class="chip add" data-act="pladd">+ Lägg till genomspelning</button></div>`;
}
function listsPart(g) {
  const inL = LISTS.filter(l => l.ids.includes(g.id));
  const head = `<button class="row" data-act="lo"><span>Listor</span>
    <span class="rv mute">${inL.length ? inL.length + (inL.length === 1 ? ' lista' : ' listor') : 'Ingen'} ${ico('chev', 16)}</span></button>`;
  if (!UI.lo) return head;
  return head + `<div class="chips">
    ${LISTS.map(l => `<button class="chip${l.ids.includes(g.id) ? ' on' : ''}" data-act="togglelist" data-l="${l.id}">${esc(l.name)}</button>`).join('')}
    <button class="chip add" data-act="newlist" data-addgame="1">+ Ny lista</button></div>`;
}
function aboutPart(g) {
  const head = `<button class="row" data-act="oo"><span>Om spelet</span><span class="rv mute">${ico('chev', 16)}</span></button>`;
  if (!UI.oo) return head;
  const item = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  return head + `${g.cf ? '<div class="note">Spelet låg på flera hyllor i Grouvee. Kolla att statusen stämmer.</div>' : ''}
    <dl class="dl">
      ${item('Utgivning', esc(g.rel || '–'))}
      ${item('Utvecklare', esc((g.dev || []).join(', ') || '–'))}
      ${item('Genre', esc((g.gen || []).join(', ') || '–'))}
      ${item('I Grouvee', esc((g.praw || []).join(', ') || '–'))}
      ${item('Tillagd', esc((g.add || '').slice(0, 10) || '–'))}
      ${g.url ? item('Länk', `<a href="${esc(g.url)}" target="_blank" rel="noopener">Grouvee</a>`) : ''}
    </dl>
    <button class="danger" data-act="delgame">Ta bort ur biblioteket</button>`;
}
// Omslaget i full storlek; ett tryck var som helst stänger. Den mindre bilden syns medan den stora laddar.
function bigCover(g) {
  return `<button class="bigc" data-act="bigclose" aria-label="Stäng omslaget">
    <img src="${IGDB_IMG}t_1080p/${g.cov}.jpg" alt="Omslag: ${esc(g.n)}"
      style="background-image:url(${IGDB_IMG}t_cover_big/${g.cov}.jpg)"></button>`;
}
function renderGame() {
  const el = $('#game'), g = UI.game && GM[UI.game];
  document.body.classList.toggle('lock', !!g);
  el.className = g ? 'open' : '';
  if (!g) { el.innerHTML = ''; return; }
  const s = SM[g.s] || SM.backlog;
  // Utvecklare och serier är länkar till biblioteket filtrerat på dem.
  const devs = (g.dev || []).slice(0, 2).map(d => `<button class="lnk2" data-act="dev" data-v="${esc(d)}">${esc(d)}</button>`);
  const sub = [year(g) && esc(year(g))].concat(devs.length ? [devs.join(', ')] : []).filter(Boolean).join(' · ');
  const series = gameSeries(g).map(s => `<button class="serie" data-act="ser" data-v="${esc(s)}">
      ${ico('lists', 14)}<span>${esc(s)}</span><i>${SERIES[s]} spel</i></button>`).join('');
  const sep = '<div class="sep"></div>';
  el.innerHTML = `<div class="backdrop" data-act="close"></div>
  <div class="gp" style="--tint:${rgba(s.c, 0.16)}">
    <div class="gtop"><button class="icon" data-act="close" aria-label="Tillbaka">${ico('back', 24)}</button></div>
    <div class="ghero">
      ${g.cov ? `<button class="cbtn" data-act="big" aria-label="Visa omslaget stort">${cover(g)}</button>` : cover(g, `<span class="ct">${esc(g.n)}</span>`)}
      <div class="gt"><h1>${esc(g.n)}</h1><span class="mute">${sub}</span>${series}</div>
    </div>
    <div class="box">
      ${statusPart(g, s)}${sep}${ratingPart(g)}${sep}${platformPart(g)}${sep}
      <textarea class="notein" data-act="note" rows="2" maxlength="500" placeholder="Notering" aria-label="Notering">${esc(g.note || '')}</textarea>
    </div>
    <div class="box">${playthroughPart(g)}${sep}${listsPart(g)}${sep}${aboutPart(g)}</div>
  </div>
  ${UI.big && g.cov ? bigCover(g) : ''}`;
}

function render() {
  renderSide(); renderSheet(); renderTabs(); renderHead(); renderBody(); renderGame();
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 2600);
}
