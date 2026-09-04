# Statussy

Glanceable “is anything down?” board for AI providers. A SmartScale app, separate from Zerro.

The board reads **live status from Postgres** for providers the worker fetches (OpenAI today) and falls back to mock data for the rest. Nothing is scraped from the client.

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
`provider_snapshots`, `components`, `incidents`), seeds the 10 board providers,
and ticks on a configurable interval (default every 5 minutes). Each tick fetches
live status for providers with a fetcher — currently OpenAI via its
Statuspage-compatible API (`/api/v2/summary.json` + `/api/v2/incidents.json`) —
and upserts snapshot, component, and incident rows. On a failed fetch the worker
keeps last-known rows and flags the latest snapshot `stale`. Fetchers for the
other providers are later tickets, and the board still renders mock data.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Railway (worker, read/write) and later Vercel (Next.js app, read-only) | Postgres connection string. On Railway, reference the Postgres service (`${{Postgres.DATABASE_URL}}`). Point Vercel at the same database's public connection URL when the board switches to live reads. |
| `REFRESH_INTERVAL_SECONDS` | Railway (worker) | Seconds between cron ticks. Optional, defaults to `300` (5 minutes). |
| `PORT` | Railway (worker) | Injected by Railway; the health endpoint listens on it (defaults to `8080` locally). |
| `FETCH_TIMEOUT_MS` | Railway (worker) | Per-request timeout for provider status fetches. Optional, defaults to `10000`. |
| `FETCH_USER_AGENT` | Railway (worker) | User-Agent header sent to provider status APIs. Optional, defaults to `statussy-worker/0.1 (+https://github.com/SmartScaleAI/statussy)`. |

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

## Board data: live + mock fallback

[`getStatusBoard()`](lib/status.ts) is the only read path the UI uses. On each
request it reads the latest `provider_snapshots` row per provider from Postgres
(server-side only, via `DATABASE_URL` — see
[`lib/live-status.ts`](lib/live-status.ts)) and merges it over the mock
registry in [`data/services.ts`](data/services.ts).

Fallback policy (SMA-18):

- **Provider has snapshots** (OpenAI today): the card shows the live overall
  status, the snapshot's incident title / fetch time, and an **uptime**
  chicklet derived from the last 24h of non-stale snapshots (share reporting
  `operational` — a board heuristic, not a vendor SLA). A **Stale** badge
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
