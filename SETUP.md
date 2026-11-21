# Nycklar att skapa (görs på datorn, ca 15 min totalt)

## 1. Cloudflare API-token (så Claude kan driftsätta servern)
1. dash.cloudflare.com → profilikonen uppe till höger → **Profile** → **API Tokens** → **Create Token**.
2. Mallen **Edit Cloudflare Workers** → **Use template**.
3. **Permissions** → **+ Add more** → `Account` · `D1` · `Edit`.
4. **Account Resources**: ditt konto. **Zone Resources**: låt *All zones* stå.
5. **Continue to summary** → **Create Token** → kopiera (visas bara en gång).
6. Lägg in den i Claude-miljön: sessionens titelrad → molnmiljöns meny → **Edit** → **Network secrets**
   - Host: `api.cloudflare.com` · Header: `Authorization` · Värde: `Bearer <token>`
   - Klistra aldrig in den i chatten.

## 2. Twitch/IGDB (speldata och omslag)
1. dev.twitch.tv → logga in (kräver 2FA på Twitch-kontot).
2. **Your Console** → **Applications** → **Register Your Application**.
   - Name: valfritt, t.ex. `speltracker-robin`
   - OAuth Redirect URL: `http://localhost`
   - Category: *Application Integration* · Client Type: *Confidential*
3. Öppna appen → kopiera **Client ID** → **New Secret** → kopiera **Client Secret**.
4. Säg till Claude i chatten när de finns – de läggs in i Workern på säkert sätt (inte i chatten).

## 3. Servern i Cloudflare (ingen API-token behövs, ca 10 min på datorn)
1. dash.cloudflare.com → **Compute (Workers)** → **Workers & Pages** → **Create** → **Start with Hello World!**
2. Namn: `speltracker` → **Deploy**.
3. **Edit code** → markera allt i editorn och ta bort det → klistra in hela innehållet från
   https://raw.githubusercontent.com/Ukeitaro0/speltracker/main/worker/worker.js → **Deploy**.
4. Tillbaka till workern → **Settings** → **Variables and Secrets** → **+ Add**, två gånger:
   - Type **Secret**, Name `TWITCH_CLIENT_ID`, Value = Client ID från Twitch
   - Type **Secret**, Name `TWITCH_CLIENT_SECRET`, Value = Client Secret från Twitch
   - **Deploy**.
5. Öppna workerns adress (står överst, slutar på `.workers.dev`). Visar den `"twitch":"ok"` fungerar det.
6. Skicka adressen till Claude. Adressen är inte hemlig, men id och secret ska aldrig in i chatten.
