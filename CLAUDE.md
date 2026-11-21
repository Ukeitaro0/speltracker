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
- **Kategorier (status):** Wishlist, Playing, Replaying, Paused/Shelved, Abandoned, Backlog. Ett spel har en status. Hela biblioteket visas med markering per status.
- **Egna listor:** Robin skapar listor (årslistor m.m.) och lägger till spel. Ett spel kan ligga i flera listor.
- **Betyg:** 1–5 (samma skala som Grouvee, importeras rakt av).
- **Plattformar Robin har:** Steam (PC), PlayStation, Xbox. Plattform sätts per spel i biblioteket.
- **Speldata:** IGDB (Twitch). Kräver server pga hemlig nyckel + CORS → anrop går via Workern. Speldata (namn, omslag, år, plattformar) sparas i vår databas när spelet läggs till, så appen inte beror på IGDB för visning.
- **Backend:** Cloudflare Worker + D1 (gratisnivå). Valt före Supabase eftersom Supabase gratis pausar projekt efter 7 dagars inaktivitet.
- **Inloggning:** en lång personlig kod (en användare), sparas en gång per enhet.
- **Import:** Grouvee CSV först (officiell export). IGN Playlist används som avstämning (vad saknas/skiljer), inte som fullständig import.
- **Mobil:** flikar längst ner. **Dator:** sidomeny (samma mönster som Hyllan).

## Faser
1. Kärnan: sök via IGDB, lägg till, status, betyg, plattform, biblioteksvy.
2. Grouvee-import med matchningsrapport, egna listor, avstämning mot IGN.
3. Konton: Steam (officiellt API) → Xbox (OpenXBL) → PSN (inofficiellt, skört).

## Status / väntar på
- Cloudflare-konto: skapat (Google-inloggning). API-token: Robin nekade formuläret (request_credential) 2026-11-21, fråga inte igen i den chatten. Alternativ: Robin lägger in den själv under miljöns Network secrets (host api.cloudflare.com), eller manuell driftsättning via Cloudflares webbredigerare.
- Mockup v1: Robin ville ha modernare, rundare, pastell, mer färg i mörkt läge, dropdown för kategori/listor, mindre info på spelsidan, ikoner för Steam/PS/Xbox.
- Mockup v2: tre förslag A Lavendel, B Salvia, C Solnedgång.
- **Valt (2026-11-21): A:s bibliotek (rutnät 2 kolumner, rubriken är dropdown → ark underifrån med kategorier + listor, flytande flikrad), B:s färgskala (Salvia: bg #121A18, yta #1B2622, text #EAF2EE, dämpad #9DB0A8, accent #B5E3C8, stjärnor #EBD9B4, typsnitt DM Sans) och B:s spelkort (inställningsrader: status-dropdown, betyg, plattformsikoner; Listor och Om spelet hopfällda; toppen tonas efter status).** Ihopslaget på ritytan under rubriken "Valt" (Valt_Bibliotek, Valt_Spel, Valt_Dator). Datorvyn i vald stil väntar på Robins OK.
- Gemensamma pastellfärger per status: Playing #A8E6CF, Replaying #C9B8FF, Backlog #B8C4D9, Wishlist #FFE3A3, Paused #FFC9A8, Abandoned #F4A9B8. Plattformsikoner från simple-icons (Xbox finns bara i äldre version, 6.0.0).
- Steg-för-steg för båda nycklarna: `SETUP.md`. Robin gör det på datorn när han har tid (Cloudflares sida fungerade dåligt på mobilen).
- Twitch/IGDB-nyckel: Robin fixar senare (2FA-koden går till en annan telefon).
- Grouvee-export: behövs först i fas 2.
