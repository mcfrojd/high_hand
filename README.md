# HIGH HAND

Visa kvällens high hand på en skärm (TV i fullskärm) och uppdatera den från mobilen.
Flera klubbar kan använda tjänsten samtidigt. Var och en får en egen nyckel.

___
### Användning

1. Gå till **https://highhand.se** och välj språk (svenska/engelska). Fyll i klubbnamn om du vill och klicka på **Skapa**.
2. Du får två länkar:
   - **Skärm:** `https://highhand.se/<nyckel>/` öppnas på TV:n i fullskärm.
   - **Admin:** `https://highhand.se/<nyckel>/admin/` öppnas på mobilen.
3. Uppdatera kort, hand, innehavare och antal i admin och klicka på **Spara**. Skärmen uppdateras direkt.
   I menyn (☰) kan du ändra klubbnamn, språk och bakgrund.

Nyckeln **raderas automatiskt 48 timmar efter att den skapades**. Spara länkarna, för de kan inte återskapas.
Den som känner till nyckeln kan öppna både skärmen och admin.

___
### Teknik

- **Cloudflare Workers** med statiska filer (`public/`) och en **Durable Object** per nyckel (`src/session.js`).
- Skärmen får ändringar via **WebSocket** (hibernation). Den frågar alltså inte servern hela tiden, och inaktiva skärmar kostar ingenting.
- En alarm i Durable Objecten raderar all data efter 48 h.
- Ingen Google Sheets, ingen databas att sätta upp och **inga hemligheter eller API-nycklar** behövs.

```
src/worker.js     routing + API (/api/session, /api/<key>/state, /api/<key>/ws)
src/session.js    Durable Object: lagring, WebSocket, 48 h-utgång
src/model.js      validering av alla värden
public/           startsida, display.html (skärm), admin.html, css, js, bilder
```

___
### Lokal utveckling

```bash
npm install
npx wrangler dev
```

Öppna http://localhost:8787. Om du vill testa utgången snabbt kan du skapa filen `.dev.vars` (den ignoreras av git) med `TTL_MS=30000`.

___
### Driftsättning (gratis)

1. Logga in på Cloudflare och gå till **Workers & Pages → Create → Import a repository**. Välj det här repot.
   Build command lämnas tomt och deploy command är `npx wrangler deploy`.
2. Lägg till domänen under **Settings → Domains & Routes → Custom domain**: `highhand.se`.
3. Rekommenderat skydd mot missbruk är en gratis regel under **Security → WAF → Rate limiting rules**:
   `URI Path equals /api/session` och `Request Method equals POST`, max 5 requests per 10 sekunder per IP, åtgärd Block.

Koppla deploy via Cloudflares GitHub-integration som ovan, så behövs ingen token i repot.
Om du hellre vill använda GitHub Actions lägger du `CLOUDFLARE_API_TOKEN` som en **GitHub-secret**, aldrig i koden.

**Gratisnivån** räcker gott: 100 000 Worker-requests per dag och Durable Objects med SQLite-lagring ingår.

___
### Om den gamla Google Sheets-versionen

Tidigare versioner av repot pekade på ett Google-ark och ett Apps Script. Länkarna finns kvar i git-historiken,
och vem som helst med länken kan skriva till arket. Gör därför följande:
- Arkivera eller ta bort Apps Script-driftsättningen (**Deploy → Manage deployments**).
- Gör arket privat.

___
### Screenshots
![hh aktuell](screenshots/hh-aktuell.jpg)
![hh pre](screenshots/hh-pre.jpg)
![hh admin](screenshots/hh-admin.jpg)
___
