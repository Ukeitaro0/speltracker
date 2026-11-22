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
- **Plattformar (konsolmodeller sedan 2026-11-22):** familj (ikon) + valfri modell, enligt Robins lista: PC (Steam `steam`, Annan `pco`), PlayStation (`ps1`–`ps5`), Xbox (`xb`, `x360`, `xsx` Series X), Nintendo (`nes`, `snes`, `n64`, Annan `nino`; egen NES-handkontrollikon), iOS. `g.p` = familje-id (`ps`, `xbox`, `pc`, `nin`, `ios`) om modell okänd, annars modell-id. Ingen Xbox One (Robin har aldrig haft en; Grouvees Xbox One → Series X). Gamla `other` togs bort ur datan (`tools/migrate_models.py`) men visas fortfarande om det dyker upp. Modellraden syns under ikonerna när en familj är vald. Statistik grupperar per familj; årsvyn visar modellerna på en rad.
- **Kritiker-/användarbetyg (2026-11-21):** från IGDB, `cr` = aggregated_rating, `ur` = rating (0–100), hämtas med `tools/fetch_covers.py`. Bibliotek: liten färgad siffra (cr) bredvid stjärnorna. Spelkort: diskret rad `IGDB 87 · User 82` under eget betyg. Färg: ≥75 grön, 50–74 gul, <50 rosa. Sorteringsval "Kritikerbetyg". Metacritic valdes bort (inget API).
- **Genomspelningar (byggt 2026-11-22):** `pl=[{y,p,o}]` per spel (o = played/abandoned/null=pågår). Robin valde B: varje klar-/omspelning är en rad (status, år, plattform); spelets plattformar = summan. Hopfälld rad "Genomspelningar (n)" på spelkortet. Årslistorna played 20XX kan bli genomspelningar automatiskt (listorna tas inte bort utan godkännande).
- **Statistik (byggt 2026-11-22):** topp 3 i årsvyn = de tre översta i listan "played ÅÅÅÅ" (Robin ordnar via Ändra ordning), annars efter betyg. Kort "Nya eller äldre" (utgivna samma år vs äldre, + äldsta spelet). femte flik "Statistik". Start = översikt av hela biblioteket (rutor inkl. completion rate, spelat per år staplat klarat/gett upp/pågår, status, plattform, genre). Tryck på ett år → årsvy (alla spel spelade det året oavsett utfall, completion rate, topp 3, plattform, genre, rutnät med alla årets spel). Completion rate = klarade / (klarade + gett upp). Mockups: Stat_Oversikt, Stat_Kronika på ritytan.
- **Automatiska årtal (2026-11-22):** status Spelar/Spelar om skapar en genomspelning med innevarande år + plattform och lägger spelet sist i "played ÅÅÅÅ" (skapas vid behov); Klarat/Gett upp avslutar den om den är från i år; är den från ett tidigare år står den kvar som "Fortsatte" (o=null) och en ny rad för i år får utfallet (ändrat 2026-11-22, så att spelet räknas båda åren). Klarat/Gett upp utan genomspelning skapar en för i år (toast), utom när spelet redan var Klarat/Gett upp. Plattformsval uppdaterar senaste genomspelningen om den pågår/är från i år/saknar plattform; tidigare plattformar visas med ring.
- **Stort omslag (2026-11-22):** tryck på omslaget på spelkortet → IGDB `t_1080p` över mörk bakgrund, tryck/Esc stänger.
- **Släppt ÅÅÅÅ – ligger kvar (2026-11-22):** sist i årsvyn, spel utgivna det året med status Backlog/Wishlist som inte spelats det året.
- **Listordning:** "Ändra ordning" i listvyn → en rad per spel, dra i handtaget (pointer events). År kan ändras för hand under Genomspelningar. played-listorna konverteras en gång (utfall = spelets status).
- **Serier och utvecklare (2026-11-22):** `ser` = IGDB collections (hämtas med `tools/fetch_covers.py`). På spelkortet: utvecklare (högst 2) som länkar under titeln + upp till två serieknappar (bara serier med ≥2 spel hos Robin, största först, dubbletter med samma spel visas en gång). Tryck → biblioteket filtrerat (`V.f = ser:<namn>` / `dev:<namn>`), i utgivningsordning. Utvecklarnamn från Grouvee, inte sammanslagna (Capcom ≠ Capcom Development Division 1).
- **Tillbaka (2026-11-22):** navigering sparas i webbläsarhistoriken (`go()`/`restore()` i events.js, state `{tab,f,year,game,d,y}`). Tillbaka-pil i rubriken när d>0; flikbyte = ny början (d=0). Tillbaka från serie/utvecklare öppnar spelkortet igen; scrolläget återställs.
- **IGDB-sök (2026-11-22):** Workern körs på `https://speltracker.ukeitaro.workers.dev` (Robins konto, subdomän ukeitaro, Twitch-nycklarna som Secrets i Cloudflare). `js/igdb.js`: sökfliken visar träffar i biblioteket (kompakta rader) + "Från IGDB" (debounce 350 ms, spel som redan finns döljs/visas med status). "Lägg till" skapar spelet i `PATCH.add` med id `g<igdb-id>` och alla fält (omslag, år, genre, utvecklare, cr/ur, serie), öppnar spelkortet med statusvalet. Dubblettkontroll på igdb-id. Workern nås inte från Claudes molnmiljö (testas med Playwright-route). Ändras worker/worker.js måste Robin klistra in den igen i Cloudflare (Edit code → Deploy). Om editorn säger read-only: välj versionen märkt "Latest" i versionsväljaren uppe till vänster. Senast driftsatt 2026-11-22 (med cr/ur/serie).
- **Synk (2026-11-22):** `POST /sync` i Workern, D1-databas bunden som `DB` (tabell `store`, nyckel `patch`, skapas automatiskt), skyddad med Secret `SYNC_KEY` (Robins egen kod, skrivs in en gång per enhet under Mer → Koppla synk, sparas i localStorage `st_sync_key`). Appen skickar hela PATCH, servern slår ihop (`mergePatch`, samma kod i worker.js och js/sync.js: per spel senaste `t` vinner fältvis, `add` union, `del` störst |t| vinner där negativt = återställt, `lists` senaste `lt`). Synkar vid start, när appen visas igen och 1,5 s efter varje ändring. Rensa-knappen döljs när synk är på (den skulle ändå fyllas på från servern). Kopiera ändringar finns kvar för att Claude ska kunna föra in i grundfilen.
- **Notering:** kort fritext per spel (`note`, max 500 tecken), fält under Plattform på spelkortet. Sparas när fältet lämnas.
- **Speldata:** IGDB (Twitch). Kräver server pga hemlig nyckel + CORS → anrop går via Workern. Speldata (namn, omslag, år, plattformar) sparas i vår databas när spelet läggs till, så appen inte beror på IGDB för visning.
- **Backend:** Cloudflare Worker + D1 (gratisnivå). Valt före Supabase eftersom Supabase gratis pausar projekt efter 7 dagars inaktivitet.
- **Inloggning:** en lång personlig kod (en användare), sparas en gång per enhet.
- **Import:** Grouvee CSV först (officiell export). IGN Playlist används som avstämning (vad saknas/skiljer), inte som fullständig import.
- **Mobil:** flikar längst ner. **Dator:** sidomeny (samma mönster som Hyllan).

## Filer i repot
- `index.html` – skal: ikoner (SVG-symboler), behållare och skript i ordning. `const BUILD` och `?v=` på css/js sätts av `bump.sh`; appen laddar om sig själv när `version.json` ändras. Ingen byggprocess.
- `style.css` – all stil. Färgerna som variabler i `:root`; datoranpassning i `@media (min-width:900px)` längst ner.
- `js/data.js` – konstanter, hjälpare, tillstånd (BASE/PATCH/UI) och all logik som ändrar data (setGame, editLists, setStatus, genomspelningar, sortering/urval).
- `js/views.js` – all HTML-ritning (kort, navigering, flikar, spelkortet uppdelat i delar). Läser bara data.
- `js/stats.js` – statistikfliken (översikt + årsvy).
- `js/events.js` – `ACTIONS`-tabellen: knappar har `data-act="namn"` → `ACTIONS[namn](knapp, spel)`. Plus change/input, dra-för-att-flytta.
- `js/start.js` – laddar library.json och kollar version.
- Ny funktion = ny vy-del i views.js/stats.js + ev. åtgärd i ACTIONS + ev. datafunktion i data.js. Håll mallarna på läsbara rader.
- `data/library.json` – grundbiblioteket `{games:[{id,n,igdb,rel,s,r,p,praw,gen,dev,add,url,cov?,cr?,ur?,ser?,note?,pl?,cf?}], lists:[{id,name,ids}]}`. Skapas med `python3 tools/import_grouvee.py <export.json>`. Kontouppgifter tas aldrig med (repot är publikt).
- Lokala ändringar ligger i localStorage `st_patch_v1` `{g:{id:{s,r,p,note,pl,t}}, add:[], del:{}, lists}` ovanpå grundfilen. Robin kan trycka Mer → Kopiera ändringar och klistra in i chatten; Claude kör `python3 tools/merge_patch.py patch.json` (spara inklistrad text som fil först) och committar `data/library.json`. Appen rensar själv bort lokala ändringar som redan finns i grundfilen (`prune()`), så Robin behöver inte slänga något.
- `dev/test.js` – Playwright-test med skärmdumpar (mobil iPhone 13 + dator 1440×900): `node dev/test.js <utmapp>`.

## Flöde för en ändring
1. Ändra i `js/` / `style.css`. 2. Syntaxkolla: `for f in js/*.js; do node --check $f; done`. 3. `node dev/test.js` och titta på skärmdumparna.
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
  - Workern driftsatt 2026-11-22 (manuellt via Cloudflares webbredigerare). Synk byggd och uppsatt samma dag (D1 `speltracker` bunden som DB, SYNC_KEY inlagd, `"sync":"ok"`).
- Grouvee-export inläst 2026-11-21: 545 spel, 13 listor (hyllor som inte är status blev listor, med Grouvees ordning). Hyllan "Played" (336 spel) blev en sjunde status, **Klarat** (#8FD3F4) – godkänd av Robin. Prioritet vid flera hyllor: Playing > abandoned > Backlog > Wish List > Played; 24 spel märkta `cf` (Mer → Kolla status). Plattform: PC→Steam, PlayStation*→PS, Xbox*→Xbox, övrigt→Annan; 328 saknade plattform (Mer → Saknar plattform); 313 kvar efter första inklistringen 2026-11-21.
- GitHub Pages: påslaget 2026-11-21, appen nås på https://ukeitaro0.github.io/speltracker/ (github.io går inte att nå från Claudes molnmiljö – testa lokalt med dev/test.js).
