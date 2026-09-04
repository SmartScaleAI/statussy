/**
 * Statussy worker (SMA-15 skeleton).
 *
 * On boot: applies migrations, seeds the static provider registry, then ticks
 * on a fixed interval (REFRESH_INTERVAL_SECONDS, default 300 = 5 minutes).
 * Each tick fetches live status for providers with a fetcher (currently
 * OpenAI via the Statuspage-compatible API, SMA-16) and writes snapshots,
 * components, and incidents to Postgres. A tiny HTTP server exposes /healthz.
 */
import { createServer } from "node:http"
import { loadConfig } from "./config.js"
import { createPool } from "./db.js"
import { runMigrations } from "./migrate.js"
import { seedProviders } from "./seed.js"
import { fetchStatuspageState } from "./statuspage.js"
import { markProviderStale, persistProviderState } from "./store.js"

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
await seedProviders(pool)
console.log("[worker] provider registry seeded")

// Providers fetched each tick. Other providers stay fetcher_type='none'
// in the registry until their fetchers land (later tickets).
const STATUSPAGE_PROVIDERS = [{ id: "openai", baseUrl: "https://status.openai.com" }] as const

async function fetchProvider(provider: { id: string; baseUrl: string }): Promise<boolean> {
  try {
    const fetched = await fetchStatuspageState(provider.baseUrl, {
      timeoutMs: config.fetchTimeoutMs,
      userAgent: config.fetchUserAgent,
    })
    await persistProviderState(pool, provider.id, fetched)
    console.log(
      `[fetch] ${provider.id} ok status=${fetched.status} components=${fetched.components.length} incidents=${fetched.incidents.length}`,
    )
    return true
  } catch (err) {
    console.error(`[fetch] ${provider.id} failed: ${(err as Error).message}`)
    // Keep last-known rows; just flag the latest snapshot as stale.
    await markProviderStale(pool, provider.id).catch((staleErr: Error) => {
      console.error(`[fetch] ${provider.id} could not mark stale: ${staleErr.message}`)
    })
    return false
  }
}

async function runTick(): Promise<void> {
  const tickNumber = ++state.tickCount
  try {
    const results = await Promise.all(STATUSPAGE_PROVIDERS.map(fetchProvider))
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
