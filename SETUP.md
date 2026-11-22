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

## 4. Synk mellan telefon och dator (ca 5 min på datorn)
1. Cloudflare → **Storage & databases** → **D1** → **Create database** → namn `speltracker` → Create.
2. Workern **speltracker** → **Bindings** (eller Settings → Bindings) → **Add binding** → **D1 database**
   → Variable name `DB` → välj databasen `speltracker` → spara/deploy.
3. Workern → **Settings** → **Variables and secrets** → **Add**: Key `SYNC_KEY`, Value = en egen lång kod
   (minst 20 tecken, t.ex. fyra slumpord + siffror), kryssa **Secret** → Add variable and deploy. Spara koden i lösenordshanteraren.
4. **Edit code** (välj versionen *Latest* om editorn är skrivskyddad) → klistra in senaste worker.js → **Deploy**.
5. Öppna workerns adress: `"sync":"ok"` betyder klart.
6. I appen på varje enhet: **Mer → Koppla synk** → skriv in koden.
