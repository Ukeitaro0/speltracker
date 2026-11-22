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
    await p.click('[data-act="plat"][data-p="ps"]');
    if (!(await p.$('[data-act="platm"]'))) await p.click('[data-act="plat"][data-p="ps"]');
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
    await p.click('[data-act="lo"]'); await p.click('[data-act="oo"]');
    await p.screenshot({ path: out + '/m5_spelkort_oppen.png', fullPage: false });
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
    await p.click('#tabs [data-tab="search"]'); await p.fill('#q', 'final fantasy');
    await p.screenshot({ path: out + '/m8_sok.png' });
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
    await p.click('[data-act="po"]');
    await p.screenshot({ path: out + '/m10_genomspelningar.png' });
    await p.selectOption('[data-act="ply"][data-i="0"]', '2025');
    if ((await p.evaluate(id => GM[id].pl[0].y, bid)) !== 2025) errors.push('mobil: år gick inte att ändra');
    await p.click('[data-act="close"].icon');
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
    await p.click('[data-act="year"][data-y="2025"]');
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
