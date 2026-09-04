# Statussy

Glanceable “is anything down?” board for AI providers. A SmartScale app, separate from Zerro.

v0 is a dark homepage of course-style provider cards with **mock data only**. Live Statuspage / RSS feeds are next — nothing is scraped today.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
```

## Data is mock

Provider cards come from [`data/services.ts`](data/services.ts). Statuses are seeded so the board is not all-green. The footer on the page is explicit: `mock data · live feeds next`.

To plug in live feeds later, keep the `Service` type in that file and replace the static `status` / `incidentTitle` / `updatedAt` fields with a mapper from Statuspage JSON or RSS. [`getStatusBoard()`](lib/status.ts) is the only read path the UI uses. Card history sparklines come from [`getStatusHistory()`](lib/status.ts) — mock 30-day series until a feed supplies real incident windows.

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

Non-operational services automatically float to the top of the board. Card accent color follows status severity using the Geist palette (green / amber / blue / red), not a random theme.

## Provider logos

Each card shows a static brand-colored mark in the header. Files live in [`public/logos/`](public/logos/) and are named `{service.id}.svg` (for example `public/logos/openai.svg`). They are served as-is from `/logos/{id}.svg` — no CDN and no animation. Hex values and asset sources are listed in [`public/logos/README.md`](public/logos/README.md).
