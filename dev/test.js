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
    await p.fill('.notein', 'Fastnade på sista bossen');
    await p.click('[data-act="rate"][data-n="3"]');
    if (await p.$eval('[data-act="rate"][data-n="4"]', e => e.classList.contains('on'))) errors.push('mobil: stjärnklick efter notering tappades');
    const gid = await p.evaluate(() => UI.game);
    await p.click('[data-act="close"].icon'); await p.evaluate(id => openGame(id), gid); await p.waitForSelector('#game.open');
    if ((await p.inputValue('.notein')) !== 'Fastnade på sista bossen') errors.push('mobil: noteringen sparades inte');
    await p.click('[data-act="rate"][data-n="4"]');
    await p.click('[data-act="lo"]'); await p.click('[data-act="oo"]');
    await p.screenshot({ path: out + '/m5_spelkort_oppen.png', fullPage: false });
    await p.click('[data-act="close"].icon');
    await p.click('#tabs [data-tab="lists"]');
    await p.screenshot({ path: out + '/m6_listor.png' });
    await p.click('#mbody [data-f="l:l11"]');
    await p.screenshot({ path: out + '/m7_topp25.png' });
    await p.click('#tabs [data-tab="search"]'); await p.fill('#q', 'final fantasy');
    await p.screenshot({ path: out + '/m8_sok.png' });
    await p.click('#tabs [data-tab="more"]');
    await p.screenshot({ path: out + '/m9_mer.png' });
    const patch = await p.evaluate(() => localStorage.getItem('st_patch_v1'));
    if (!patch || !patch.includes('"s":"paused"')) errors.push('ändringen sparades inte');
    // Dator
    const d = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const q = await d.newPage();
    q.on('pageerror', e => errors.push('dator: ' + e.message));
    await q.goto(URL); await q.waitForSelector('.card');
    await q.screenshot({ path: out + '/d1_bibliotek.png' });
    await q.click('#side [data-f="l:l11"]');
    await q.click('.card');
    await q.screenshot({ path: out + '/d2_spelkort.png' });
  } finally {
    await b.close(); srv.kill();
  }
  console.log(errors.length ? 'FEL:\n' + errors.join('\n') : 'Inga fel');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
