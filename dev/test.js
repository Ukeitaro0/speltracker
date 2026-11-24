// Kör appen lokalt i Playwright och tar skärmdumpar (mobil + dator).
// Användning: node dev/test.js [utmapp]   (startar en egen webbserver på port 8765)
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const out = process.argv[2] || 'dev/shots';
require('fs').mkdirSync(out, { recursive: true });
const root = path.join(__dirname, '..');
const srv = spawn('python3', ['-m', 'http.server', '8765'], { cwd: root, stdio: 'ignore' });
const URL = 'http://localhost:8765/';
const errors = [];
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  try {
    // Mobil
    const m = await b.newContext({ ...devices['iPhone 13'] });
    const p = await m.newPage();
    p.on('pageerror', e => errors.push('mobil: ' + e.message));
    await p.goto(URL); await p.waitForSelector('.card');
    await p.screenshot({ path: out + '/m1_bibliotek.png' });
    await p.selectOption('#mhead [data-act="sort"]', 'name');
    if ((await p.evaluate(() => V.sort)) !== 'name') errors.push('mobil: sorteringsknappen fungerade inte');
    await p.selectOption('#mhead [data-act="sort"]', 'add');
    await p.evaluate(() => scrollTo(0, 600)); await p.waitForTimeout(300);
    await p.screenshot({ path: out + '/m1b_skrollad.png' });
    if (!(await p.evaluate(() => document.body.classList.contains('scrolled')))) errors.push('mobil: liten rubrik visades inte vid skroll');
    await p.evaluate(() => scrollTo(0, 0));
    await p.click('.ttl'); await p.waitForSelector('#sheet.open');
    await p.screenshot({ path: out + '/m2_ark.png' });
    await p.click('#sheet [data-f="s:playing"]');
    await p.screenshot({ path: out + '/m3_playing.png' });
    await p.click('.card');
    await p.waitForSelector('#game.open');
    await p.click('[data-act="so"]');
    await p.screenshot({ path: out + '/m4_spelkort_status.png' });
    await p.click('[data-act="status"][data-s="paused"]');
    await p.click('[data-act="rate"][data-n="4"]');
    await p.click('[data-act="pm"]'); await p.click('[data-act="plat"][data-p="ps"]');
    if (!(await p.$('[data-act="platm"]'))) {
      if (!(await p.$('[data-act="plat"]'))) await p.click('[data-act="pm"]');
      await p.click('[data-act="plat"][data-p="ps"]');
    }
    await p.screenshot({ path: out + '/m4b_modeller.png' });
    await p.click('[data-act="platm"][data-p="ps5"]');
    if ((await p.evaluate(() => GM[UI.game].p)) !== 'ps5') errors.push('mobil: modellval PS5 fungerade inte');
    await p.fill('.notein', 'Fastnade på sista bossen');
    await p.click('[data-act="rate"][data-n="3"]');
    if (await p.$eval('[data-act="rate"][data-n="4"]', e => e.classList.contains('on'))) errors.push('mobil: stjärnklick efter notering tappades');
    const gid = await p.evaluate(() => UI.game);
    await p.click('[data-act="close"].icon'); await p.evaluate(id => openGame(id), gid); await p.waitForSelector('#game.open');
    if ((await p.inputValue('.notein')) !== 'Fastnade på sista bossen') errors.push('mobil: noteringen sparades inte');
    await p.click('[data-act="rate"][data-n="4"]');
    await p.screenshot({ path: out + '/m5_spelkort_oppen.png', fullPage: false });
    // Flikraden syns ovanpå spelkortet
    const tb = await (await p.$('#tabs .tbar')).boundingBox();
    if (!(await p.evaluate(([x, y]) => !!document.elementFromPoint(x, y).closest('#tabs'), [tb.x + 30, tb.y + 30]))) errors.push('mobil: flikraden syns inte på spelkortet');
    await p.click('[data-act="gm"]'); await p.waitForSelector('.gmenu'); await p.waitForTimeout(300);
    await p.screenshot({ path: out + '/m5c_meny.png' });
    await p.click('.mshade');
    await p.click('[data-act="sub"][data-k="lo"]');
    await p.screenshot({ path: out + '/m5d_listor.png' });
    await p.click('#game [data-act="back"]'); await p.waitForTimeout(200);
    if (!(await p.evaluate(id => UI.game === id && !UI.sub, gid))) errors.push('mobil: tillbaka från undersida fel');
    await p.click('[data-act="big"]'); await p.waitForSelector('.bigc');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: out + '/m5b_stort_omslag.png' });
    await p.click('.bigc');
    if (await p.$('.bigc')) errors.push('mobil: stora omslaget stängdes inte');
    await p.click('[data-act="close"].icon');
    await p.click('#tabs [data-tab="lists"]');
    await p.screenshot({ path: out + '/m6_listor.png' });
    await p.click('#mbody [data-f="l:l11"]');
    await p.screenshot({ path: out + '/m7_topp25.png' });
    // Sök i IGDB (servern låtsas: svaret kommer härifrån)
    // Synk: "andra enheten" har gett Man of Medan 5 stjärnor. Servern svarar med det + det vi skickade.
    let syncBody = null;
    await p.route('https://speltracker.ukeitaro.workers.dev/sync', r => {
      syncBody = JSON.parse(r.request().postData()).patch;
      if (r.request().headers()['authorization'] !== 'Bearer testkod') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Fel synkkod"}' });
      const merged = Object.assign({}, syncBody, { g: Object.assign({}, syncBody.g, { g130863: { r: 5, t: Date.now() + 1e6 } }) });
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ patch: merged, t: Date.now() }) });
    });
    await p.click('#tabs [data-tab="more"]');
    p.once('dialog', d => d.accept('testkod'));
    await p.click('[data-act="synckey"]');
    await p.waitForFunction(() => SYNC.state === 'ok');
    if ((await p.evaluate(() => GM['g130863'].r)) !== 5) errors.push('mobil: synk tog inte in ändring från andra enheten');
    if (!syncBody || !syncBody.g || !Object.keys(syncBody.g).length) errors.push('mobil: synk skickade inga lokala ändringar');
    await p.screenshot({ path: out + '/m18_synk.png' });
    // Steam: speltid och senast spelad på spelkortet (servern låtsas)
    const portal = await p.evaluate(() => GAMES.find(g => g.n === 'Portal 2'));
    await p.route('https://speltracker.ukeitaro.workers.dev/steam**', r => r.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ t: Date.now(), games: [[620, 'Portal 2', 1234, Math.floor(Date.now() / 1000) - 3 * 86400, portal.igdb]] }) }));
    await p.evaluate(() => loadSteam(true)); await p.waitForFunction(() => STEAM && STEAM.games.length === 1);
    await p.evaluate(id => openGame(id), portal.id); await p.waitForSelector('#game.open .played');
    const pl3 = await p.textContent('#game .played');
    if (!/för 3 dagar sedan · 21\u00a0h på Steam/.test(pl3)) errors.push('mobil: steamraden fel: ' + pl3);
    await p.screenshot({ path: out + '/m18b_steam.png' });
    await p.evaluate(() => closeGame()); await p.waitForTimeout(300);
    await p.unroute('https://speltracker.ukeitaro.workers.dev/sync');
    await p.route('https://speltracker.ukeitaro.workers.dev/sync', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ patch: JSON.parse(r.request().postData()).patch }) }));
    await p.route('https://speltracker.ukeitaro.workers.dev/search**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify([
      { id: 999999, name: 'Testspel: Nytt', first_release_date: 1700000000, cover: { image_id: 'co39s8' }, platforms: [{ abbreviation: 'PS5' }, { abbreviation: 'PC' }],
        genres: [{ name: 'Adventure' }], involved_companies: [{ developer: true, company: { name: 'Testbolag' } }], aggregated_rating: 81.4, collections: [{ name: 'Testserie' }] },
      { id: 55047, name: 'The Dark Pictures Anthology: Man of Medan', first_release_date: 1567036800 }
    ]) }));
    await p.click('#tabs [data-tab="search"]'); await p.fill('#q', 'dark pictures');
    await p.waitForSelector('[data-act="igadd"]');
    await p.screenshot({ path: out + '/m16_igdb_sok.png' });
    if (await p.$('[data-act="igadd"][data-i="55047"]')) errors.push('mobil: spel som redan finns erbjöds att läggas till');
    await p.click('[data-act="igadd"][data-i="999999"]'); await p.waitForSelector('#game.open .opts');
    const ng = await p.evaluate(() => GM['g999999']);
    if (!ng || ng.dev[0] !== 'Testbolag' || ng.cr !== 81 || ng.cov !== 'co39s8' || ng.rel !== '2023-11-14') errors.push('mobil: tillagt IGDB-spel fel ' + JSON.stringify(ng));
    await p.screenshot({ path: out + '/m17_igdb_tillagd.png' });
    await p.click('[data-act="status"][data-s="wishlist"]');
    await p.click('[data-act="close"].icon');
    await p.click('#tabs [data-tab="search"]'); await p.fill('#q', 'final fantasy');
    await p.screenshot({ path: out + '/m8_sok.png' });
    await p.click('.search .qx');
    if ((await p.inputValue('#q')) !== '' || (await p.evaluate(() => UI.q)) !== '') errors.push('mobil: x i sökrutan rensade inte');
    if (await p.isVisible('.search .qx')) errors.push('mobil: x syns i tom sökruta');
    await p.click('#tabs [data-tab="more"]');
    await p.screenshot({ path: out + '/m9_mer.png' });
    // Genomspelning skapas automatiskt och spelet hamnar i årets lista
    const yr = new Date().getFullYear();
    const bid = await p.evaluate(() => GAMES.find(g => g.s === 'backlog' && !(g.pl || []).length).id);
    await p.evaluate(id => openGame(id), bid); await p.waitForSelector('#game.open');
    await p.click('[data-act="so"]'); await p.click('[data-act="status"][data-s="playing"]');
    await p.click('[data-act="so"]'); await p.click('[data-act="status"][data-s="played"]');
    const pl = await p.evaluate(id => GM[id].pl, bid);
    if (!pl || pl.length !== 1 || pl[0].y !== yr || pl[0].o !== 'played') errors.push('mobil: genomspelning fel ' + JSON.stringify(pl));
    if (!(await p.evaluate(([id, y]) => LISTS.some(l => l.name === 'played ' + y && l.ids.includes(id)), [bid, yr]))) errors.push('mobil: spelet kom inte med i årslistan');
    const carried = await p.evaluate(yr => {
      const g = GAMES.find(x => x.s === 'backlog' && !(x.pl || []).length && x.id !== UI.game);
      setGame(g.id, { s: 'playing', pl: [{ y: yr - 1, p: null, o: null }] });
      setStatus(GM[g.id], 'played');
      return GM[g.id].pl;
    }, yr);
    if (carried.length !== 2 || carried[0].o !== null || carried[1].y !== yr || carried[1].o !== 'played') errors.push('mobil: fortsatt genomspelning fel ' + JSON.stringify(carried));
    await p.click('[data-act="sub"][data-k="po"]');
    await p.screenshot({ path: out + '/m10_genomspelningar.png' });
    await p.selectOption('[data-act="ply"][data-i="0"]', '2025');
    if ((await p.evaluate(id => GM[id].pl[0].y, bid)) !== 2025) errors.push('mobil: år gick inte att ändra');
    await p.evaluate(() => closeGame()); await p.waitForTimeout(300);
    if (await p.evaluate(() => UI.game)) errors.push('mobil: spelkortet stängdes inte från undersida');
    // Tillägg: TBC är ett eget spel som hör till WoW; Cataclysm saknas och läggs till från huvudspelets lista
    await p.evaluate(() => openGame('g123')); await p.waitForSelector('#game.open');
    await p.click('[data-act="sub"][data-k="dl"]');
    if (!(await p.$('.dlb[data-id="g110856"]'))) errors.push('mobil: Burning Crusade syns inte som spel under WoW');
    if ((await p.evaluate(() => GM.g110856.par)) !== 'g123') errors.push('mobil: tillägget vet inte sitt huvudspel');
    const cata = await p.evaluate(() => GM.g123.dlc.find(x => /Cataclysm/.test(x[1]))[0]);
    await p.route('https://speltracker.ukeitaro.workers.dev/games**', r => r.fulfill({ contentType: 'application/json',
      body: JSON.stringify([{ id: cata, name: 'World of Warcraft: Cataclysm', first_release_date: 1291680000, cover: { image_id: 'co1xbv' } }]) }));
    await p.screenshot({ path: out + '/m19_tillagg.png' });
    await p.click(`[data-act="dladd"][data-i="${cata}"]`); await p.waitForSelector('#game.open .opts');
    await p.click('[data-act="status"][data-s="wishlist"]');
    const added = await p.evaluate(c => { const g = GAMES.find(x => x.igdb === c); return g && [g.s, g.par, g.cov]; }, cata);
    if (!added || added[0] !== 'wishlist' || added[1] !== 'g123' || added[2] !== 'co1xbv') errors.push('mobil: tillägg lades inte till rätt ' + JSON.stringify(added));
    await p.screenshot({ path: out + '/m19b_tillagg_spel.png' });
    await p.evaluate(() => closeGame()); await p.waitForTimeout(300);
    // Gamla bockar (g.dx) i lokala ändringar blir riktiga spel
    const mop = await p.evaluate(() => { const d = GM.g123.dlc.find(x => /Pandaria/.test(x[1]));
      PATCH.g.g123 = Object.assign(PATCH.g.g123 || {}, { dx: { [d[0]]: 4 } }); rebuild();
      const g = GAMES.find(x => x.igdb === d[0]); return g && [g.s, g.r, g.par, !!PATCH.g.g123.dx]; });
    if (!mop || mop.join() !== 'played,4,g123,false') errors.push('mobil: gamla bockar blev inte spel ' + JSON.stringify(mop));
    // Serie och utvecklare
    const mid = await p.evaluate(() => GAMES.find(g => /Man of Medan/.test(g.n)).id);
    await p.evaluate(id => openGame(id), mid); await p.waitForSelector('#game.open');
    await p.screenshot({ path: out + '/m14_serie_spelkort.png' });
    await p.click('[data-act="ser"]');
    await p.waitForTimeout(300);
    await p.screenshot({ path: out + '/m15_serie.png' });
    if (!(await p.evaluate(() => current().arr.length >= 2 && !UI.game))) errors.push('mobil: seriefiltret fungerade inte');
    await p.click('#mhead [data-act="back"]'); await p.waitForTimeout(300);
    if (!(await p.evaluate(id => UI.game === id, mid))) errors.push('mobil: tillbaka från serie öppnade inte spelkortet igen');
    await p.click('[data-act="close"].icon'); await p.waitForTimeout(300);
    await p.evaluate(id => openGame(id), mid); await p.waitForSelector('#game.open');
    await p.click('[data-act="dev"]'); await p.waitForTimeout(300);
    if (!(await p.evaluate(() => V.f.startsWith('dev:') && current().arr.length >= 5))) errors.push('mobil: utvecklarfiltret fungerade inte');
    // Statistik
    await p.click('#tabs [data-tab="stats"]');
    await p.screenshot({ path: out + '/m11_statistik.png', fullPage: true });
    await p.selectOption('[data-act="yearsel"]', '2025');
    if ((await p.evaluate(() => UI.year)) !== 2025) errors.push('mobil: årsmenyn fungerade inte');
    await p.screenshot({ path: out + '/m12_ar.png', fullPage: true });
    // Ändra ordning i played 2025: dra första spelet till tredje plats
    await p.evaluate(() => { const l = LISTS.find(x => x.name === 'played 2025'); setView({ f: 'l:' + l.id }); UI.tab = 'lib'; render(); });
    const before = await p.evaluate(() => current().arr.map(g => g.id));
    await p.click('[data-act="reorder"]');
    const g0 = await p.$('.ror:nth-child(1) .grip'), r3 = await p.$('.ror:nth-child(3)');
    const b0 = await g0.boundingBox(), b3 = await r3.boundingBox();
    await p.mouse.move(b0.x + 20, b0.y + 20); await p.mouse.down();
    await p.mouse.move(b0.x + 20, b3.y + b3.height - 5, { steps: 8 }); await p.mouse.up();
    await p.screenshot({ path: out + '/m13_ordning.png' });
    const after = await p.evaluate(() => current().arr.map(g => g.id));
    if (after[2] !== before[0] || after[0] !== before[1]) errors.push('mobil: dra-för-att-flytta fungerade inte ' + after.slice(0, 3) + ' / ' + before.slice(0, 3));
    const patch = await p.evaluate(() => localStorage.getItem('st_patch_v1'));
    if (!patch || !patch.includes('"s":"paused"')) errors.push('ändringen sparades inte');
    // Dator
    const d = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const q = await d.newPage();
    q.on('pageerror', e => errors.push('dator: ' + e.message));
    await q.goto(URL); await q.waitForSelector('.card');
    await q.screenshot({ path: out + '/d1_bibliotek.png' });
    // Sidomeny: årslistor hopfällda från början, nyaste året först när de fälls ut
    if (await q.$('#side [data-f^="l:"][data-f*="l1795"]')) errors.push('dator: årslistor syntes trots hopfälld grupp');
    await q.click('#side [data-act="fold"][data-k="years"]');
    const yrs = await q.$$eval('#side .sscroll .rows:last-child .nrow', els => els.map(e => e.textContent.trim().match(/\d{4}/)?.[0]).filter(Boolean).map(Number));
    if (yrs.join() !== yrs.slice().sort((a, b) => b - a).join() || yrs.length < 10) errors.push('dator: årslistor inte i fallande ordning ' + yrs);
    await q.screenshot({ path: out + '/d1b_sidomeny.png' });
    await q.keyboard.press('/');
    if (!(await q.evaluate(() => document.activeElement && document.activeElement.id === 'q'))) errors.push('dator: / fokuserade inte sökrutan');
    await q.keyboard.press('Escape'); await q.evaluate(() => document.activeElement.blur());
    await q.click('#side [data-tab="stats"]');
    await q.screenshot({ path: out + '/d3_statistik.png' });
    await q.click('[data-act="year"][data-y="2025"]');
    await q.screenshot({ path: out + '/d4_ar.png' });
    await q.click('#side [data-f="l:l11"]');
    await q.click('.card');
    await q.screenshot({ path: out + '/d2_spelkort.png' });
  } finally {
    await b.close(); srv.kill();
  }
  console.log(errors.length ? 'FEL:\n' + errors.join('\n') : 'Inga fel');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
