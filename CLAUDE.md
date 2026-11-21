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
- Mockup v1 (mobil bibliotek, mobil spelkort, dator bibliotek): väntar på Robins synpunkter.
- Twitch/IGDB-nyckel: Robin fixar senare (2FA-koden går till en annan telefon).
- Grouvee-export: behövs först i fas 2.
