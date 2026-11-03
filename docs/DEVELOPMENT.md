# Utveckling och drift

Teknisk dokumentation för den som vill köra eller vidareutveckla High Hand.
För hur tjänsten används, se [README.md](../README.md).

## Teknik

- **Cloudflare Workers** med statiska filer (`public/`) och en **Durable Object** per nyckel (`src/session.js`).
- Skärmen får ändringar via **WebSocket** (hibernation). Den frågar alltså inte servern hela tiden, och inaktiva skärmar kostar ingenting.
- En alarm i Durable Objecten raderar sessionens data efter 48 h.
- **Egen bakgrundsbild** lagras i sessionens Durable Object under nyckeln `bg`. Webbläsaren skalar ned bilden till högst 1920 px JPEG före uppladdning, och servern godtar högst 1,5 MB.
  Anropen är `PUT`, `GET` och `DELETE` på `/api/<key>/background`. En ny uppladdning skriver över den gamla, och bilden raderas tillsammans med sessionen.
- Ingen databas att sätta upp och **inga hemligheter i repot**.

```
src/worker.js     routing + API (/api/session, /api/<key>/state, /api/<key>/ws, /api/pair, /api/dashboard)
src/session.js    Durable Object per nyckel: lagring, WebSocket, 48 h-utgång
src/registry.js   global Durable Object: logg för dashboarden (30 dagar)
src/pairing.js    Durable Object per TV-kod (/tv), 10 min, engångs
src/model.js      validering av alla värden
public/           startsida, display.html (skärm), admin.html, tv.html, dashboard.html, css, js, bilder
wrangler.jsonc    Worker, assets, Durable Object-bindningar och migrationer
```

## Lokal utveckling

```bash
npm install
npx wrangler dev
```

Öppna http://localhost:8787.

Lokala inställningar läggs i `.dev.vars`, som ignoreras av git:

```
TTL_MS=30000              # kortare livslängd för att testa utgång
DASHBOARD_PASSWORD=test   # aktiverar /dashboard/ lokalt
```

## Driftsättning (gratis)

1. Gå till Cloudflare: **Workers & Pages → Create → Import a repository** och välj repot.
   Lämna build command tomt och sätt deploy command till `npx wrangler deploy`.
2. Lägg till en egen domän under **Settings → Domains & Routes → Custom domain**.
3. Rekommenderat: lägg till regler för rate limiting under **Security → WAF → Rate limiting rules**, för `POST /api/session`, `POST /api/pair` och `/dashboard`.

Workers Builds driftsätter automatiskt vid varje push till `main`.
Ingen token behövs i repot. Om du hellre vill använda GitHub Actions lägger du `CLOUDFLARE_API_TOKEN` som en GitHub-secret.

Gratisnivån räcker gott: 100 000 Worker-requests per dag och Durable Objects med SQLite-lagring ingår.

## Privat dashboard

`/dashboard/` visar två saker:
- aktiva sessioner
- en logg över de senaste 30 dagarna med datum, klubbnamn, senaste riktiga high hand, innehavare och antal

Loggen kan filtreras och exporteras som CSV.

Dashboarden är avstängd (404) tills ett lösenord har satts som **Secret** på Workern. Det görs under **Settings → Variables and Secrets** (inte under Build), eller så här:

```bash
npx wrangler secret put DASHBOARD_PASSWORD
```

Logga in med användarnamnet `admin` och lösenordet.

## Notis vid ny session (ntfy)

Workern kan skicka en notis till en [ntfy](https://ntfy.sh)-server varje gång en ny session skapas.
Notisen innehåller klubbnamn, språkkod, land och skärmlänken. Den har också knapparna **Skärm** och **Dashboard**.
Skärmlänkens nyckel ger även åtkomst till admin, så använd en privat topic med token.
Notisen skickas i bakgrunden, så ett fel hos ntfy påverkar aldrig att sessionen skapas.

Funktionen aktiveras med Secrets på Workern under **Settings → Variables and Secrets**, inte under Build:

| Namn | Värde |
|---|---|
| `NTFY_URL` | `https://<din-ntfy-server>/<topic>` |
| `NTFY_TOKEN` | Åtkomsttoken (`tk_…`). Behövs bara om topicen är skyddad. |

Om `NTFY_URL` saknas skickas ingen notis.

## Version

Sidfoten på startsidan och admin visar till exempel `v2.1.0 (b5db583e)`.
- `2.1.0` är `version` i `package.json`. Den höjs vid varje release.
- Koden inom parentes är början på Cloudflares **Version ID** för den driftsatta Workern, via bindningen `CF_VERSION_METADATA` i `wrangler.jsonc`. Den ska stämma med den översta raden under **Deployments** i Cloudflare.
- Håll muspekaren över versionen för att se när den driftsattes och hela Version ID:t.

`GET /api/version` returnerar samma uppgifter som JSON.
