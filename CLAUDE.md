# Speltracker – Robins egen spelhylla

Läs hela filen innan du gör något. Den sammanfattar besluten (start nov 2026).

## Vad det är
- Personlig speltracker: bibliotek, kategorier, betyg, plattform, egna listor (t.ex. årslistor).
- Webbapp (en enda `index.html`, vanilla JS, ingen byggprocess) på GitHub Pages, plus en Cloudflare Worker som backend.
- Används som hemskärmsapp på iPhone (Safari) och i webbläsare på Windows-dator. **Bara Robin använder den.**

## Arbetssätt med Robin (viktigt)
- Svara på svenska, kort, punktat, ett steg i taget. Inga artiga följdfrågor på slutet.
- **Less is more.** Nya saker ska passa in i helheten utan att plottra.
- **Ta aldrig bort något utan Robins godkännande.** Föreslå i stället.
- Bolla och visa mockups innan större omgörningar. Mockup-ritytan: https://claude.ai/artifact/RJYV7ypRaEgfS3ioQ6UBdb
- Robin committar inte själv. Claude committar och pushar direkt till `main` (GitHub Pages bygger från main) och driftsätter Workern.
- Räkna på kostnad. Mål: 0 kr/mån.

## Beslut som är tagna
- **Kategorier (status), namn (Backlog/Wishlist på engelska sedan 2026-11-21):** Spelar (playing), Spelar om (replaying), Pausat (paused), Backlog (backlog), Wishlist (wishlist), Klarat (played), Gett upp (abandoned). Interna id:n i parentes är oförändrade. Ett spel har en status. Hela biblioteket visas med markering per status.
- **Egna listor:** Robin skapar listor (årslistor m.m.) och lägger till spel. Ett spel kan ligga i flera listor.
- **Betyg:** 1–5 (samma skala som Grouvee, importeras rakt av). Ord per steg: 1 Dåligt, 2 Sådär, 3 Bra, 4 Riktigt bra, 5 Kanonspel! Visas under "Betyg" på spelkortet och som hovertext på datorn.
- **Plattformar Robin har:** Steam (PC), PlayStation, Xbox, iOS (id `ios`, Apple-ikon, tillagd 2026-11-21) + Annan (`other`, t.ex. Nintendo). Plattform sätts per spel i biblioteket.
- **Kritiker-/användarbetyg (2026-11-21):** från IGDB, `cr` = aggregated_rating, `ur` = rating (0–100), hämtas med `tools/fetch_covers.py`. Bibliotek: liten färgad siffra (cr) bredvid stjärnorna. Spelkort: diskret rad `IGDB 87 · User 82` under eget betyg. Färg: ≥75 grön, 50–74 gul, <50 rosa. Sorteringsval "Kritikerbetyg". Metacritic valdes bort (inget API).
- **Genomspelningar (beslut 2026-11-22, ej byggt):** Robin valde B: varje klar-/omspelning är en rad (status, år, plattform); spelets plattformar = summan. Hopfälld rad "Genomspelningar (n)" på spelkortet. Årslistorna played 20XX kan bli genomspelningar automatiskt (listorna tas inte bort utan godkännande).
- **Statistik (beslut 2026-11-22, ej byggt):** femte flik "Statistik". Mockups på ritytan under "Statistik: Översikt och Årskrönika" (Stat_Oversikt, Stat_Kronika), riktiga siffror. Väntar på Robins val.
- **Notering:** kort fritext per spel (`note`, max 500 tecken), fält under Plattform på spelkortet. Sparas när fältet lämnas.
- **Speldata:** IGDB (Twitch). Kräver server pga hemlig nyckel + CORS → anrop går via Workern. Speldata (namn, omslag, år, plattformar) sparas i vår databas när spelet läggs till, så appen inte beror på IGDB för visning.
- **Backend:** Cloudflare Worker + D1 (gratisnivå). Valt före Supabase eftersom Supabase gratis pausar projekt efter 7 dagars inaktivitet.
- **Inloggning:** en lång personlig kod (en användare), sparas en gång per enhet.
- **Import:** Grouvee CSV först (officiell export). IGN Playlist används som avstämning (vad saknas/skiljer), inte som fullständig import.
- **Mobil:** flikar längst ner. **Dator:** sidomeny (samma mönster som Hyllan).

## Filer i repot
- `index.html` – hela appen (CSS + JS inline). `const BUILD` sätts av `bump.sh`; appen laddar om sig själv när `version.json` ändras.
- `data/library.json` – grundbiblioteket `{games:[{id,n,igdb,rel,s,r,p,praw,gen,dev,add,url,cov?,cr?,ur?,note?,cf?}], lists:[{id,name,ids}]}`. Skapas med `python3 tools/import_grouvee.py <export.json>`. Kontouppgifter tas aldrig med (repot är publikt).
- Lokala ändringar ligger i localStorage `st_patch_v1` `{g:{id:{s,r,p,note,t}}, add:[], del:{}, lists}` ovanpå grundfilen. Robin kan trycka Mer → Kopiera ändringar och klistra in i chatten; Claude kör `python3 tools/merge_patch.py patch.json` (spara inklistrad text som fil först) och committar `data/library.json`. Appen rensar själv bort lokala ändringar som redan finns i grundfilen (`prune()`), så Robin behöver inte slänga något.
- `dev/test.js` – Playwright-test med skärmdumpar (mobil iPhone 13 + dator 1440×900): `node dev/test.js <utmapp>`.

## Flöde för en ändring
1. Ändra `index.html`. 2. Syntaxkolla JS (extrahera `<script>` och `node --check`). 3. `node dev/test.js` och titta på skärmdumparna.
4. `./bump.sh`. 5. Commit (svensk text) och `git -c push.negotiate=true push origin HEAD:main`. 6. Berätta vilken version (BUILD) det blev.

## Faser
1. Kärnan: sök via IGDB, lägg till, status, betyg, plattform, biblioteksvy.
2. Grouvee-import med matchningsrapport, egna listor, avstämning mot IGN.
3. Konton: Steam (officiellt API) → Xbox (OpenXBL) → PSN (inofficiellt, skört).

## Status / väntar på
- Cloudflare-konto: skapat (Google-inloggning). API-token: Robin nekade formuläret (request_credential) 2026-11-21, fråga inte igen i den chatten. Alternativ: Robin lägger in den själv under miljöns Network secrets (host api.cloudflare.com), eller manuell driftsättning via Cloudflares webbredigerare.
- Mockup v1: Robin ville ha modernare, rundare, pastell, mer färg i mörkt läge, dropdown för kategori/listor, mindre info på spelsidan, ikoner för Steam/PS/Xbox.
- Mockup v2: tre förslag A Lavendel, B Salvia, C Solnedgång.
- **Valt (2026-11-21): A:s bibliotek (rutnät 2 kolumner, rubriken är dropdown → ark underifrån med kategorier + listor, flytande flikrad), B:s färgskala (Salvia: bg #121A18, yta #1B2622, text #EAF2EE, dämpad #9DB0A8, accent #B5E3C8, stjärnor #EBD9B4, typsnitt DM Sans) och B:s spelkort (inställningsrader: status-dropdown, betyg, plattformsikoner; Listor och Om spelet hopfällda; toppen tonas efter status).** Ihopslaget på ritytan under rubriken "Valt" (Valt_Bibliotek, Valt_Spel, Valt_Dator). Första versionen byggd i den stilen.
- Gemensamma pastellfärger per status: Playing #A8E6CF, Replaying #C9B8FF, Backlog #B8C4D9, Wishlist #FFE3A3, Paused #FFC9A8, Abandoned #F4A9B8. Plattformsikoner från simple-icons (Xbox finns bara i äldre version, 6.0.0).
- Steg-för-steg för båda nycklarna: `SETUP.md`. Robin gör det på datorn när han har tid (Cloudflares sida fungerade dåligt på mobilen).
- Twitch/IGDB-nyckel: Robin har Client ID + Secret (2026-11-21). Lägger dem som miljövariabler `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` i molnmiljön "Standard" (gäller från nästa session). Värdarna id.twitch.tv, api.igdb.com, images.igdb.com är tillåtna i miljön.
  - Klart 2026-11-21: omslag på alla 545 spel (`python3 tools/fetch_covers.py`; de 6 utan igdb-id kopplades för hand). Egen bild per spel: inte byggt, kräver lagring (Worker) – tas upp igen då.
  - Sök i IGDB från appen kräver Workern (`worker/worker.js`, steg 3 i SETUP.md) – görs på datorn senare.
- Grouvee-export inläst 2026-11-21: 545 spel, 13 listor (hyllor som inte är status blev listor, med Grouvees ordning). Hyllan "Played" (336 spel) blev en sjunde status, **Klarat** (#8FD3F4) – godkänd av Robin. Prioritet vid flera hyllor: Playing > abandoned > Backlog > Wish List > Played; 24 spel märkta `cf` (Mer → Kolla status). Plattform: PC→Steam, PlayStation*→PS, Xbox*→Xbox, övrigt→Annan; 328 saknade plattform (Mer → Saknar plattform); 313 kvar efter första inklistringen 2026-11-21.
- GitHub Pages: påslaget 2026-11-21, appen nås på https://ukeitaro0.github.io/speltracker/ (github.io går inte att nå från Claudes molnmiljö – testa lokalt med dev/test.js).
