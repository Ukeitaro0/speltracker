// Klistras in i webbläsarens konsol (F12) på https://www.ign.com/playlist/Ukeitaro/library
// medan man är inloggad. Scrollar tills alla spel laddats och kopierar en JSON-lista
// (titel, IGN-länk, statusikon) till urklipp. Klistra sedan in i chatten med Claude.
(async () => {
  const tiles = () => document.querySelectorAll('figure[data-cy="object-tile"]');
  let n = -1;
  for (let i = 0; i < 200; i++) {
    scrollTo(0, document.body.scrollHeight);
    const more = [...document.querySelectorAll('button')].find(b => /load more|show more|visa fler/i.test(b.textContent));
    if (more) more.click();
    await new Promise(r => setTimeout(r, 1500));
    if (tiles().length === n) break;
    n = tiles().length;
  }
  const g = [...tiles()].map(f => ({
    n: (f.querySelector('[data-cy="tile-title"]') || {}).textContent,
    u: (f.querySelector('a') || { getAttribute: () => '' }).getAttribute('href'),
    s: (((f.querySelector('span.status-indicator') || { getAttribute: () => '' }).getAttribute('style') || '')
      .match(/media\/(\w+)/) || [])[1]
  }));
  // copy() finns inte alltid (IGN:s sida skuggar den) – visa i en ruta och kopiera därifrån.
  const t = document.createElement('textarea');
  t.value = JSON.stringify({ url: location.href, g });
  t.style = 'position:fixed;inset:20px;z-index:99999;font-size:12px';
  document.body.appendChild(t);
  t.focus(); t.select();
  const ok = document.execCommand('copy');
  alert(g.length + ' spel. ' + (ok ? 'Kopierat! Klistra in i chatten.' : 'Tryck Ctrl+C i rutan.'));
})();
