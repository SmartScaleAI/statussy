/**
 * Statussy worker (SMA-15 skeleton).
 *
 * On boot: applies migrations, seeds the static service registry, then ticks
 * on a fixed interval (REFRESH_INTERVAL_SECONDS, default 300 = 5 minutes).
 * Each tick fetches live status for services with a fetcher (OpenAI per
 * SMA-16; Anthropic, Groq, and Cohere per SMA-19 — all via the
 * Statuspage-compatible API; OpenRouter via OnlineOrNot, SMA-21; Perplexity
 * via Instatus, SMA-20; xAI and DeepSeek via their RSS/Atom status feeds,
 * SMA-22; Mistral via its Checkly/Nuxt `__NUXT_DATA__` HTML payload,
 * SMA-25; Google Gemini via Google Cloud Status incidents.json, SMA-26)
 * and writes snapshots, components, and incidents to Postgres.
 * A tiny HTTP server exposes /healthz.
 */
import { createServer } from "node:http"
import { loadConfig } from "./config.js"
import { createPool } from "./db.js"
import { fetchChecklyNuxtState } from "./checkly-nuxt.js"
import { fetchInstatusState } from "./instatus.js"
import { runMigrations } from "./migrate.js"
import { fetchRssState } from "./rss.js"
import { seedServices } from "./seed.js"
import { fetchOnlineOrNotState } from "./onlineornot.js"
import { fetchGoogleCloudGeminiState } from "./google-cloud.js"
import { fetchStatuspageState } from "./statuspage.js"
import {
  markServiceStale,
  persistServiceState,
  type PersistableServiceState,
  type PersistOptions,
} from "./store.js"

const config = loadConfig()
const pool = createPool(config.databaseUrl)

const state = {
  startedAt: new Date(),
  tickCount: 0,
  lastTickAt: null as Date | null,
  lastTickOk: null as boolean | null,
}

console.log(
  `[worker] starting (interval=${config.refreshIntervalSeconds}s, port=${config.port})`,
)

const applied = await runMigrations(pool)
console.log(
  applied.length > 0
    ? `[worker] migrations applied: ${applied.join(", ")}`
    : "[worker] schema up to date",
)
await seedServices(pool)
console.log("[worker] service registry seeded")

const fetchOptions = () => ({
  timeoutMs: config.fetchTimeoutMs,
  userAgent: config.fetchUserAgent,
})

type ServiceJob = {
  id: string
  fetch: () => Promise<PersistableServiceState>
  persistOptions?: PersistOptions
}

// All 10 board services are fetched each tick.
const statuspageJob = (id: string, baseUrl: string): ServiceJob => ({
  id,
  fetch: () => fetchStatuspageState(baseUrl, fetchOptions()),
})

// SMA-22: services whose status page is only exposed as an RSS/Atom feed.
// Feed URLs are tried in order; DeepSeek serves the same items as both
// feed.rss and feed.atom.
const rssJob = (id: string, feedUrls: readonly string[]): ServiceJob => ({
  id,
  fetch: () => fetchRssState(feedUrls, fetchOptions()),
})

const SERVICE_JOBS: ServiceJob[] = [
  statuspageJob("openai", "https://status.openai.com"),
  statuspageJob("anthropic", "https://status.claude.com"),
  statuspageJob("groq", "https://groqstatus.com"),
  statuspageJob("cohere", "https://status.cohere.com"),
  {
    // SMA-21: OpenRouter via OnlineOrNot. The summary API only lists active
    // incidents, so ones that drop out are marked resolved at persist time.
    id: "openrouter",
    fetch: () => fetchOnlineOrNotState("status.openrouter.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // SMA-20: Perplexity via Instatus. summary.json also only carries
    // *active* incidents, so ones that drop out are resolved at persist time.
    id: "perplexity",
    fetch: () => fetchInstatusState("https://status.perplexity.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  rssJob("xai", ["https://status.x.ai/feed.xml"]),
  rssJob("deepseek", [
    "https://status.deepseek.com/feed.rss",
    "https://status.deepseek.com/feed.atom",
  ]),
  {
    // SMA-26: Gemini via Google Cloud Status incidents.json. The feed mixes
    // historical incidents; we persist Gemini-relevant rows and resolve any
    // previously open ones that drop out of the open set.
    id: "google-gemini",
    fetch: () => fetchGoogleCloudGeminiState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // SMA-25: Mistral via Checkly/Nuxt HTML (__NUXT_DATA__). The payload only
    // lists *unresolved* incidents, so ones that drop out are resolved at
    // persist time. Parse/CF failures mark the latest snapshot stale.
    id: "mistral",
    fetch: () => fetchChecklyNuxtState("https://status.mistral.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
]

async function fetchService(service: ServiceJob): Promise<boolean> {
  try {
    const fetched = await service.fetch()
    await persistServiceState(
      pool,
      service.id,
      fetched,
      service.persistOptions,
    )
    console.log(
      `[fetch] ${service.id} ok status=${fetched.status} components=${fetched.components.length} incidents=${fetched.incidents.length}`,
    )
    return true
  } catch (err) {
    console.error(`[fetch] ${service.id} failed: ${(err as Error).message}`)
    // Keep last-known rows; just flag the latest snapshot as stale.
    await markServiceStale(pool, service.id).catch((staleErr: Error) => {
      console.error(`[fetch] ${service.id} could not mark stale: ${staleErr.message}`)
    })
    return false
  }
}

async function runTick(): Promise<void> {
  const tickNumber = ++state.tickCount
  try {
    const results = await Promise.all(
      SERVICE_JOBS.map((service) => fetchService(service)),
    )
    const okCount = results.filter(Boolean).length
    state.lastTickAt = new Date()
    state.lastTickOk = okCount === results.length
    console.log(
      `[tick] #${tickNumber} done ok=${okCount}/${results.length} at=${state.lastTickAt.toISOString()}`,
    )
  } catch (err) {
    state.lastTickAt = new Date()
    state.lastTickOk = false
    console.error(`[tick] #${tickNumber} failed: ${(err as Error).message}`)
  }
}

const server = createServer((req, res) => {
  if (req.url === "/healthz" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(
      JSON.stringify({
        status: "ok",
        startedAt: state.startedAt.toISOString(),
        refreshIntervalSeconds: config.refreshIntervalSeconds,
        tickCount: state.tickCount,
        lastTickAt: state.lastTickAt?.toISOString() ?? null,
        lastTickOk: state.lastTickOk,
      }),
    )
    return
  }
  res.writeHead(404, { "content-type": "application/json" })
  res.end(JSON.stringify({ status: "not_found" }))
})
server.listen(config.port, () => {
  console.log(`[worker] health endpoint on :${config.port}/healthz`)
})

await runTick()
const interval = setInterval(runTick, config.refreshIntervalSeconds * 1000)

function shutdown(signal: string): void {
  console.log(`[worker] received ${signal}, shutting down`)
  clearInterval(interval)
  server.close()
  void pool.end().finally(() => process.exit(0))
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
