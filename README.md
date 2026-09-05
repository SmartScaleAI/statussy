# Statussy

Glanceable “is anything down?” board for AI, Cloud, Developer, Data, Auth, and Payments services. A SmartScale app, separate from Zerro.

The board reads **live status from Postgres** for the 171 catalog services (26 AI + 25 Cloud + 30 Developer + 30 Data + 30 Auth + 30 Payments). AI Wave A: OpenAI, Anthropic, Groq, Cohere, OpenRouter, Perplexity, xAI, DeepSeek, Google Gemini, Mistral; Wave B: Fireworks AI, Together AI, Cerebras, Hugging Face, Replicate, Runway, Ideogram, Stability AI; Wave C: fal, ElevenLabs, MiniMax, Voyage AI, Black Forest Labs, Cartesia, Kimi, Luma. Cloud Wave A: Vercel, Railway, Cloudflare, Render, Fly.io, Netlify, DigitalOcean, Google Cloud, AWS, Azure. Cloud Wave B: Heroku, Linode, Fastly, bunny.net, Deno Deploy, Koyeb, Modal, Firebase. Cloud Wave C: Akamai, Vultr, Scaleway, Oracle Cloud, Hetzner, Northflank, Lambda. Developer Wave A: Cursor, Devin, GitHub, GitLab, CircleCI, npm, Docker, Linear, Sourcegraph, Warp. Developer Wave B: Bitbucket, Buildkite, PyPI, RubyGems, Maven Central, Postman, Augment, Factory, Tabnine, Zed. Developer Wave C: Lovable, Bolt, Replit, Travis CI, Semaphore, Harness, Codefresh, crates.io, Expo, Cloudsmith. Data Wave A: Supabase, Neon, PlanetScale, Convex, Upstash, Redis, Pinecone, MongoDB, CockroachDB, Prisma. Data Wave B: Snowflake, Databricks, ClickHouse, Elastic, Aiven, InfluxDB, Couchbase, Confluent, Tinybird, Zilliz. Data Wave C: Materialize, Turso, Qdrant, Meilisearch, Algolia, Redpanda, SurrealDB, Yugabyte, TiDB, DataStax. Auth Wave A: Auth0, Clerk, WorkOS, Okta, Stytch, Kinde, FusionAuth, Frontegg, PropelAuth, 1Password. Auth Wave B: Descope, Duo, Ping Identity, Doppler, Infisical, Zitadel, JumpCloud, Logto, Magic, Beyond Identity. Auth Wave C: LoginRadius, Scalekit, Transmit Security, SecureAuth, LastPass, Keeper, Yubico, Akeyless, SailPoint, Delinea. Payments Wave A: Stripe, PayPal, Square, Adyen, Paddle, Chargebee, Recurly, Klarna, Plaid, GoCardless. Payments Wave B: Mollie, Polar, RevenueCat, Affirm, FastSpring, Whop, Wise, Authorize.net, Flutterwave, Airwallex. Payments Wave C: Marqeta, Lithic, Worldpay, Spreedly, Finix, Mercado Pago, EBANX, Paysafe, Recharge, Maxio. The worker fetches every service that has a fetcher; AWS, Azure, Fastly, Replit, Redis, Algolia, DataStax, Okta, PayPal, and Adyen are seeded without one (custom dashboards or a status page that blocks programmatic access) and stay on mock until a dedicated fetcher exists. Nothing is scraped from the client. When a service has no snapshot yet, or the database is unreachable, the board still falls back to mock data.

GitHub is one card (Copilot, Actions, and Codespaces are components). Devin covers Desktop and Cloud; Windsurf is the legacy name and is not a separate card. Codex / Claude Code / Amazon Q stay on their AI / Cloud parents. Auth0 and Okta are separate cards; Supabase Auth, Firebase Auth, and Cognito stay on their Data / Cloud parents. Braintree and Venmo stay on PayPal. Afterpay stays on Square. Lemon Squeezy stays on Polar. Vault waits for Infra.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
```

## Live data worker (Railway)

Live-data foundation for the board: a Railway Postgres database plus a small Node
worker in [`worker/`](worker/). The worker owns the schema (`services`,
`service_snapshots`, `components`, `incidents`, `service_suggestions`), seeds the 171 board services,
and ticks on a configurable interval (default every 5 minutes). Each tick fetches
live status for services with a fetcher — OpenAI, Anthropic, Groq, Cohere,
Fireworks, Cerebras, Replicate, Runway, Ideogram, Stability, ElevenLabs,
MiniMax, Voyage, Black Forest Labs, Cartesia, and Kimi via the
Statuspage-compatible API, OpenRouter via OnlineOrNot, Perplexity and fal via
Instatus, xAI and DeepSeek via their RSS/Atom feeds, Google Gemini via Google
Cloud Status `incidents.json`, Mistral via its Checkly/Nuxt status page
(`__NUXT_DATA__` embedded in `https://status.mistral.ai/` HTML; there is no
public JSON API, and Cloudflare may challenge the fetch), Together AI,
Hugging Face, and Luma via Better Stack `index.json` (the undocumented JSON the SPA
loads — no Statuspage/RSS API; if that shape changes, follow up with a
dedicated Better Stack fetcher), Cloud Wave A Statuspage hosts (Vercel,
Cloudflare, Render, Fly.io, Netlify, DigitalOcean), Railway via
`https://api.railwaystatus.com/status` (Railway documents this JSON as-is),
Google Cloud via the same `incidents.json` feed as Gemini (platform-wide;
informational notices do not paint the card), Cloud Wave B Statuspage hosts
(Linode, bunny.net), Heroku via Status API v4 (`status.heroku.com/api/v4`;
Salesforce Trust is the public card URL), Deno Deploy and Koyeb via Instatus,
Modal via Better Stack `index.json`, Firebase via
`status.firebase.google.com/incidents.json`, Cloud Wave C Statuspage hosts
(Akamai, Scaleway, Lambda), Northflank via Instatus, Vultr via
`https://status.vultr.com/status.json`, Oracle Cloud via
`ocistatus.oraclecloud.com/api/v2/status.json` (page-level indicator only;
the components dump is not persisted), and Hetzner via `__NEXT_DATA__`
embedded in `https://status.hetzner.com/en` (informational notices and
future maintenance do not paint the card), Developer Wave A Statuspage hosts
(Cursor, Devin, GitHub, CircleCI, npm, Docker, Linear, Sourcegraph, Warp),
GitLab via Status.io (`api.status.io/1.0/status/{pageId}`; upcoming
maintenance does not paint the card), Developer Wave B Statuspage hosts
(Bitbucket, Buildkite, PyPI, RubyGems, Maven Central, Postman, Augment,
Factory, Tabnine), Zed via Instatus, and Developer Wave C Statuspage hosts
(Lovable, Bolt, Travis CI, Semaphore, Harness, Codefresh, crates.io, Expo,
Cloudsmith), Data Wave A Statuspage hosts (Supabase, PlanetScale, Convex,
Upstash, Pinecone, MongoDB, CockroachDB, Prisma), Neon via Status.io,
Data Wave B Statuspage hosts (Snowflake, ClickHouse, Elastic, Aiven,
InfluxDB, Couchbase, Confluent, Tinybird, Zilliz), Databricks via
Status.io, Data Wave C Statuspage hosts (Materialize, Redpanda, Yugabyte,
TiDB), and Turso, Qdrant, Meilisearch, and SurrealDB via Better Stack
`index.json`, Auth Wave A Statuspage hosts (Clerk, WorkOS, FusionAuth,
Frontegg, 1Password), Auth0 via `https://auth0.statuspage.io` (the public
host has no `/api/v2`), Stytch, Kinde, and PropelAuth via Instatus,
Auth Wave B Statuspage hosts (Duo, Ping Identity, Doppler, Infisical,
Zitadel, JumpCloud, Magic, Beyond Identity), Descope via Instatus,
Logto via Better Stack `index.json`, Auth Wave C Statuspage hosts
(LoginRadius, Scalekit, Transmit Security, SecureAuth, Keeper, Yubico,
Akeyless, SailPoint, Delinea), LastPass via `https://lastpass.statuspage.io`
(the public host challenges `/api/v2`), Payments Wave A Statuspage hosts
(Square, Paddle, Chargebee, Recurly, Klarna, Plaid, GoCardless), Stripe
via `https://www.stripestatus.com` (the public host has no `/api/v2`),
Mollie via Instatus, Polar via Better Stack `index.json`, and Payments
Wave B Statuspage hosts (RevenueCat, Affirm, FastSpring, Whop, Wise,
Authorize.net, Flutterwave, Airwallex), and Payments Wave C Statuspage
hosts (Marqeta, Lithic, Worldpay, Spreedly, Finix, Mercado Pago, EBANX,
Paysafe, Recharge), Maxio via `https://maxio.statuspage.io` (the public
host times out on `/api/v2`)
— and upserts snapshot,
component, and incident rows. On a failed fetch the worker keeps last-known rows
and flags the latest snapshot `stale`.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Railway (worker, read/write) and Vercel (Next.js app) | Postgres connection string. The app reads live status and inserts footer **Suggest a Service** rows into `service_suggestions` (it does not write the `services` catalog). On Railway, reference the Postgres service (`${{Postgres.DATABASE_URL}}`, private network). On Vercel, use the Railway Postgres **`DATABASE_PUBLIC_URL`** — see [Point Vercel at Railway Postgres](#point-vercel-at-railway-postgres). |
| `SLACK_WEBHOOK_URL` | Vercel (Next.js app) | Incoming webhook targeting `_alerts`. Posted after each successful suggestion insert (name, email if present, timestamp). Optional locally — a missing webhook logs a warning and still stores the row. |
| `REFRESH_INTERVAL_SECONDS` | Railway (worker) | Seconds between cron ticks. Optional, defaults to `300` (5 minutes). |
| `PORT` | Railway (worker) | Injected by Railway; the health endpoint listens on it (defaults to `8080` locally). |
| `FETCH_TIMEOUT_MS` | Railway (worker) | Per-request timeout for service status fetches. Optional, defaults to `10000`. |
| `FETCH_USER_AGENT` | Railway (worker) | User-Agent header sent to service status APIs. Optional, defaults to `statussy-worker/0.1 (+https://github.com/SmartScaleAI/statussy)`. The Mistral Checkly/Nuxt fetcher always sends a browser-like Chrome UA instead (Cloudflare in front of `status.mistral.ai` often challenges bot UAs). |

### Run the worker locally

```bash
cd worker
npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/statussy
npm run migrate   # apply migrations + seed the 171 services, then exit
npm run dev       # migrate, seed, tick on the interval, serve /healthz
```

`npm run dev` logs a `[tick]` heartbeat line on every interval; `curl
localhost:8080/healthz` reports tick count and last tick time. Use a low
interval while developing, e.g. `REFRESH_INTERVAL_SECONDS=10 npm run dev`.

### Deploy notes

- The worker deploys as a Railway service with **root directory `worker/`**;
  build and deploy settings live in [`worker/railway.json`](worker/railway.json)
  (Railpack build, `npm run start`, `/healthz` healthcheck).
- Migrations and the service seed run automatically on worker boot, so a deploy
  with a new migration file updates the schema. Both are idempotent and guarded
  by a Postgres advisory lock.
- The Postgres service lives in the same Railway project; the worker's
  `DATABASE_URL` references it over the private network.

### Suggest a Service

The site footer form takes a required service **name** and optional **email**.
Submissions go to `service_suggestions` (`status` defaults to `new`) and ping
Slack via `SLACK_WEBHOOK_URL`. They are **not** added to the board catalog.

### Point Vercel at Railway Postgres

Without a working `DATABASE_URL`, Production silently renders the mock board
(and logs a `[statussy]` warning). To switch it to live reads:

1. In Railway, open the **Postgres service → Variables** tab and copy the value
   of **`DATABASE_PUBLIC_URL`** (it routes through the public TCP proxy, e.g.
   `postgresql://postgres:…@altaria.proxy.rlwy.net:24195/railway`). **Never**
   use the private `DATABASE_URL` (`…@postgres.railway.internal…`) — that
   hostname only resolves inside Railway's network and will fail from Vercel.
2. In Vercel, open the project → **Settings → Environment Variables** and add:
   - **Key:** `DATABASE_URL` — exactly this name, **no `NEXT_PUBLIC_` prefix**.
     It is read server-side only and must never reach the client bundle.
   - **Value:** the `DATABASE_PUBLIC_URL` you copied.
   - **Environments:** **Production** (required). Preview is optional — add it
     there too if preview deploys should show live data.
3. **Redeploy.** Environment variables only apply to new deployments; the
   current one keeps serving mock data until it is rebuilt.

No `sslmode` parameter is needed: the app enables TLS automatically for any
non-private host. Railway's public proxy presents a **self-signed certificate
(CN=localhost)**, and for node-pg appending `?sslmode=require` to the URL is
**not enough** — pg still verifies the certificate chain and rejects it. The
`Pool` must be constructed with `ssl: { rejectUnauthorized: false }`, which
`lib/live-status.ts` (and the worker's `worker/src/db.ts`) now do for every
non-private host, so the connection is encrypted without CA verification. If
the connection still fails, the Vercel function logs show a
`[statussy] … read failed (db=host:port/db)` error with the cause instead of
silently rendering mock data.

## Board data: live + mock fallback

[`getStatusBoard()`](lib/status.ts) is the only read path the UI uses. On each
request it reads the latest `service_snapshots` row per service from Postgres
(server-side only, via `DATABASE_URL` — see
[`lib/live-status.ts`](lib/live-status.ts)) and merges it over the mock
registry in [`data/services.ts`](data/services.ts).

Fallback policy (SMA-18):

- **Service has snapshots** (any catalog row the worker has fetched): the card shows the live overall
  status, the snapshot's incident title / fetch time, and a **Health**
  chicklet from current `components` rows (operational count ÷ total — a live
  snapshot, not historical uptime or a vendor SLA). Services with no
  component rows show Health 100% if the latest overall status is
  `operational`, else 0%. A **Stale** badge appears when the worker flagged
  the latest snapshot stale (failed fetch) or the snapshot is older than 15
  minutes (3 missed worker ticks).
- **Service has no snapshots yet**: the card keeps its prior mock entry from
  `data/services.ts` and shows an em-dash Health placeholder.
- **No `DATABASE_URL` or the read fails**: the whole board falls back to mock.

The 30-day status-history sparkline is hidden until a real history UI exists;
its slot now holds the live Health chicklet.

## Add a service

1. Open `data/services.ts`.
2. Append an object to `services`:

```ts
{
  id: "service-id",
  name: "Service Name",
  category: "ai", // or "cloud" | "developer" | "data" | "auth" | "payments"
  statusUrl: "https://status.example.com/",
  status: "operational", // operational | degraded | partial_outage | major_outage | maintenance
  incidentTitle: "Optional short incident title",
  updatedAt: "2026-09-03T21:40:00.000Z",
}
```

3. Add a matching seed row in `worker/src/seed.ts` and a worker job when there is a fetcher.
4. Add `public/logos/{id}.svg` using the **official brand path** — Simple Icons, LobeHub, Wikimedia, or the vendor’s own SVG. Do not draw a geometric stand-in. Only replica-draw if no official mark exists. Knock official black lockups out to white (or a documented chromatic token) so they read on the dark board. Record the source in [`public/logos/README.md`](public/logos/README.md).

Non-operational services automatically float to the top of the board.

## Service logos

Each card shows a static mark next to the last-updated time. Files live in [`public/logos/`](public/logos/) and are named `{service.id}.svg` (for example `public/logos/openai.svg`). They are served as-is from `/logos/{id}.svg` — no CDN and no animation. **Always use the official logo path** (see the rule above and [`public/logos/README.md`](public/logos/README.md)).
