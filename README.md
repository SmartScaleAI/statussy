# Statussy

Glanceable “is anything down?” board for AI providers. A SmartScale app, separate from Zerro.

The board reads **live status from Postgres** for all 10 providers the worker fetches (OpenAI, Anthropic, Groq, Cohere, OpenRouter, Perplexity, xAI, DeepSeek, Google Gemini, Mistral). Nothing is scraped from the client. When a provider has no snapshot yet, or the database is unreachable, the board still falls back to mock data.

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
worker in [`worker/`](worker/). The worker owns the schema (`providers`,
`provider_snapshots`, `components`, `incidents`, `provider_suggestions`), seeds the 10 board providers,
and ticks on a configurable interval (default every 5 minutes). Each tick fetches
live status for providers with a fetcher — OpenAI, Anthropic, Groq, and Cohere
via the Statuspage-compatible API, OpenRouter via OnlineOrNot, Perplexity via
Instatus, xAI and DeepSeek via their RSS/Atom feeds, Google Gemini via Google
Cloud Status `incidents.json`, and Mistral via its Checkly/Nuxt status page
(`__NUXT_DATA__` embedded in `https://status.mistral.ai/` HTML; there is no
public JSON API, and Cloudflare may challenge the fetch) — and upserts snapshot,
component, and incident rows. On a failed fetch the worker keeps last-known rows
and flags the latest snapshot `stale`.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Railway (worker, read/write) and Vercel (Next.js app) | Postgres connection string. The app reads live status and inserts footer **Suggest a Provider** rows into `provider_suggestions` (it does not write the `providers` catalog). On Railway, reference the Postgres service (`${{Postgres.DATABASE_URL}}`, private network). On Vercel, use the Railway Postgres **`DATABASE_PUBLIC_URL`** — see [Point Vercel at Railway Postgres](#point-vercel-at-railway-postgres). |
| `SLACK_WEBHOOK_URL` | Vercel (Next.js app) | Incoming webhook targeting `_alerts`. Posted after each successful suggestion insert (name, email if present, timestamp). Optional locally — a missing webhook logs a warning and still stores the row. |
| `REFRESH_INTERVAL_SECONDS` | Railway (worker) | Seconds between cron ticks. Optional, defaults to `300` (5 minutes). |
| `PORT` | Railway (worker) | Injected by Railway; the health endpoint listens on it (defaults to `8080` locally). |
| `FETCH_TIMEOUT_MS` | Railway (worker) | Per-request timeout for provider status fetches. Optional, defaults to `10000`. |
| `FETCH_USER_AGENT` | Railway (worker) | User-Agent header sent to provider status APIs. Optional, defaults to `statussy-worker/0.1 (+https://github.com/SmartScaleAI/statussy)`. The Mistral Checkly/Nuxt fetcher always sends a browser-like Chrome UA instead (Cloudflare in front of `status.mistral.ai` often challenges bot UAs). |

### Run the worker locally

```bash
cd worker
npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/statussy
npm run migrate   # apply migrations + seed the 10 providers, then exit
npm run dev       # migrate, seed, tick on the interval, serve /healthz
```

`npm run dev` logs a `[tick]` heartbeat line on every interval; `curl
localhost:8080/healthz` reports tick count and last tick time. Use a low
interval while developing, e.g. `REFRESH_INTERVAL_SECONDS=10 npm run dev`.

### Deploy notes

- The worker deploys as a Railway service with **root directory `worker/`**;
  build and deploy settings live in [`worker/railway.json`](worker/railway.json)
  (Railpack build, `npm run start`, `/healthz` healthcheck).
- Migrations and the provider seed run automatically on worker boot, so a deploy
  with a new migration file updates the schema. Both are idempotent and guarded
  by a Postgres advisory lock.
- The Postgres service lives in the same Railway project; the worker's
  `DATABASE_URL` references it over the private network.

### Suggest a Provider

The site footer form takes a required provider **name** and optional **email**.
Submissions go to `provider_suggestions` (`status` defaults to `new`) and ping
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
request it reads the latest `provider_snapshots` row per provider from Postgres
(server-side only, via `DATABASE_URL` — see
[`lib/live-status.ts`](lib/live-status.ts)) and merges it over the mock
registry in [`data/services.ts`](data/services.ts).

Fallback policy (SMA-18):

- **Provider has snapshots** (all 10 fetched providers): the card shows the live overall
  status, the snapshot's incident title / fetch time, and an **uptime**
  chicklet: operational / total current `components` when that table has
  rows, otherwise the last 24h of non-stale snapshots reporting
  `operational` (SMA-31 board heuristic, not a vendor SLA). A **Stale** badge
  appears when the worker flagged the latest snapshot stale (failed fetch) or
  the snapshot is older than 15 minutes (3 missed worker ticks).
- **Provider has no snapshots yet**: the card keeps its prior mock entry from
  `data/services.ts` and shows an em-dash uptime placeholder.
- **No `DATABASE_URL` or the read fails**: the whole board falls back to mock.

The 30-day status-history sparkline is hidden until a real history UI exists;
its slot now holds the uptime chicklet.

## Add a provider

1. Open `data/services.ts`.
2. Append an object to `services`:

```ts
{
  id: "provider-id",
  name: "Provider Name",
  category: "ai",
  statusUrl: "https://status.example.com/",
  status: "operational", // operational | degraded | partial_outage | major_outage | maintenance
  incidentTitle: "Optional short incident title",
  updatedAt: "2026-09-03T21:40:00.000Z",
}
```

Non-operational services automatically float to the top of the board.

## Provider logos

Each card shows a static mark next to the last-updated time. Files live in [`public/logos/`](public/logos/) and are named `{service.id}.svg` (for example `public/logos/openai.svg`). They are served as-is from `/logos/{id}.svg` — no CDN and no animation. Fills use each provider’s brand color (see [`public/logos/README.md`](public/logos/README.md) for hex values and sources).
