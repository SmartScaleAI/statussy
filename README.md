# Statussy

Glanceable “is anything down?” board for AI providers. A SmartScale app, separate from Zerro.

v0 is a dark, Vercel-like homepage with **mock data only**. Live Statuspage / RSS feeds are next — nothing is scraped today.

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

Provider rows come from [`data/services.ts`](data/services.ts). Statuses are seeded so the board is not all-green. The footer on the page is explicit: `mock data · live feeds next`.

To plug in live feeds later, keep the `Service` type in that file and replace the static `status` / `incidentTitle` / `updatedAt` fields with a mapper from Statuspage JSON or RSS. [`getStatusBoard()`](lib/status.ts) is the only read path the UI uses.

## Provider logos

Each row shows a monochrome mark to the left of the provider name. Assets live in [`public/logos/`](public/logos/) — one SVG per v0 provider, named by `Service.id` (for example `openai.svg`, `google-gemini.svg`). They are simple currentColor marks vendored from [Lobe Icons](https://lobehub.com/icons) (`@lobehub/icons-static-svg`, MIT). [`ProviderLogo`](components/provider-logo.tsx) paints them with the Geist `foreground` token via CSS mask so they stay readable on the dark board.

## Add a provider

1. Open `data/services.ts`.
2. Add a monochrome SVG at `public/logos/{id}.svg` and a matching entry in [`ProviderLogo`](components/provider-logo.tsx).
3. Append an object to `services`:

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
