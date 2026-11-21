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
