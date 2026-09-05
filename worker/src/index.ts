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
 * SMA-25; Google Gemini via Google Cloud Status incidents.json, SMA-26;
 * Wave B Statuspage services per SMA-41 — Fireworks, Cerebras, Replicate,
 * Runway, Ideogram, Stability; Together AI, Hugging Face, and Luma via Better
 * Stack `index.json`; Wave C Statuspage — ElevenLabs, MiniMax, Voyage, Black
 * Forest Labs, Cartesia, Kimi; fal via Instatus; Cloud Wave A — Vercel,
 * Cloudflare, Render, Fly.io, Netlify, DigitalOcean via Statuspage, Railway
 * via api.railwaystatus.com, Google Cloud via incidents.json; Cloud Wave B —
 * Linode and bunny.net via Statuspage, Heroku via Status API v4, Deno Deploy
 * and Koyeb via Instatus, Modal via Better Stack, Firebase via
 * status.firebase.google.com incidents.json; Cloud Wave C — Akamai,
 * Scaleway, and Lambda via Statuspage, Northflank via Instatus, Vultr via
 * status.json, Oracle Cloud via ocistatus status.json, Hetzner via the
 * official page's __NEXT_DATA__; Developer Wave A — Cursor, Devin, GitHub,
 * CircleCI, npm, Docker, Linear, Sourcegraph, and Warp via Statuspage,
 * GitLab via Status.io; Developer Wave B — Bitbucket, Buildkite, PyPI,
 * RubyGems, Maven Central, Postman, Augment, Factory, and Tabnine via
 * Statuspage, Zed via Instatus. AWS, Azure, and Fastly are seeded without a
 * fetcher) and writes snapshots, components, and incidents to Postgres.
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
import {
  fetchFirebaseState,
  fetchGoogleCloudGeminiState,
  fetchGoogleCloudPlatformState,
} from "./google-cloud.js"
import { fetchGitlabState } from "./gitlab.js"
import { fetchHerokuState } from "./heroku.js"
import { fetchHetznerState } from "./hetzner.js"
import { fetchOracleCloudState } from "./oracle-cloud.js"
import { fetchRailwayState } from "./railway.js"
import { fetchVultrState } from "./vultr.js"
import { fetchBetterstackState } from "./betterstack.js"
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

// Board services with a fetcher (26 AI + Cloud Waves A–C + Developer Waves A–B;
// AWS, Azure, and Fastly are none).
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
  // SMA-41 Wave B — Statuspage-compatible pages.
  statuspageJob("fireworks", "https://status.fireworks.ai"),
  statuspageJob("cerebras", "https://status.cerebras.ai"),
  statuspageJob("replicate", "https://status.replicate.com"),
  statuspageJob("runway", "https://status.runwayml.com"),
  statuspageJob("ideogram", "https://status.ideogram.ai"),
  statuspageJob("stability", "https://status.stability.ai"),
  {
    // SMA-41: Together + Hugging Face are Better Stack SPAs. The public
    // `index.json` the SPA loads is undocumented; persist treats dropped
    // reports as resolved.
    id: "together",
    fetch: () => fetchBetterstackState("https://status.together.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "huggingface",
    fetch: () => fetchBetterstackState("https://status.huggingface.co", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Wave C — Statuspage-compatible pages. Voyage's custom domain times out on
  // /api/v2, so the fetcher hits the Statuspage host directly.
  statuspageJob("elevenlabs", "https://status.elevenlabs.io"),
  statuspageJob("minimax", "https://status.minimax.io"),
  statuspageJob("voyage", "https://voyageai-status.statuspage.io"),
  statuspageJob("bfl", "https://status.bfl.ml"),
  statuspageJob("cartesia", "https://status.cartesia.ai"),
  statuspageJob("kimi", "https://status.moonshot.cn"),
  {
    // fal is Instatus (summary.json + components.json), same dialect as Perplexity.
    id: "fal",
    fetch: () => fetchInstatusState("https://status.fal.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // Luma is a Better Stack SPA, same index.json as Together / Hugging Face.
    id: "luma",
    fetch: () => fetchBetterstackState("https://status.lumalabs.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Cloud Wave A — Statuspage-compatible hosts. Cloudflare's page-level
  // indicator is the official rollup (a single POP in maintenance must not
  // paint the card; mapStatuspage already uses status.indicator).
  statuspageJob("vercel", "https://www.vercel-status.com"),
  statuspageJob("cloudflare", "https://www.cloudflarestatus.com"),
  statuspageJob("render", "https://status.render.com"),
  statuspageJob("fly", "https://status.flyio.net"),
  statuspageJob("netlify", "https://www.netlifystatus.com"),
  statuspageJob("digitalocean", "https://status.digitalocean.com"),
  {
    id: "railway",
    fetch: () => fetchRailwayState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // Platform-wide GCP card. Informational notices stay off the rollup.
    id: "google-cloud",
    fetch: () => fetchGoogleCloudPlatformState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Cloud Wave B. Fastly has no public JSON and blocks the worker UA.
  statuspageJob("linode", "https://status.linode.com"),
  statuspageJob("bunny", "https://status.bunny.net"),
  {
    id: "heroku",
    fetch: () => fetchHerokuState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "deno",
    fetch: () => fetchInstatusState("https://denostatus.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "koyeb",
    fetch: () => fetchInstatusState("https://status.koyeb.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "modal",
    fetch: () => fetchBetterstackState("https://status.modal.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "firebase",
    fetch: () => fetchFirebaseState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Cloud Wave C — Statuspage-compatible hosts plus custom official JSON.
  statuspageJob("akamai", "https://www.akamaistatus.com"),
  statuspageJob("scaleway", "https://status.scaleway.com"),
  statuspageJob("lambda", "https://status.lambda.ai"),
  {
    id: "northflank",
    fetch: () => fetchInstatusState("https://status.northflank.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "vultr",
    fetch: () => fetchVultrState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // status.json only (no summary/incidents API; skip the 1.7MB component dump).
    id: "oracle-cloud",
    fetch: () => fetchOracleCloudState(fetchOptions()),
  },
  {
    id: "hetzner",
    fetch: () => fetchHetznerState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Developer Wave A. Copilot / Actions / Codespaces stay GitHub components.
  statuspageJob("cursor", "https://status.cursor.com"),
  statuspageJob("devin", "https://status.devin.ai"),
  statuspageJob("github", "https://www.githubstatus.com"),
  {
    id: "gitlab",
    fetch: () => fetchGitlabState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("circleci", "https://status.circleci.com"),
  statuspageJob("npm", "https://status.npmjs.org"),
  statuspageJob("docker", "https://www.dockerstatus.com"),
  statuspageJob("linear", "https://linearstatus.com"),
  statuspageJob("sourcegraph", "https://sourcegraphstatus.com"),
  statuspageJob("warp", "https://status.warp.dev"),
  // Developer Wave B. More forges, registries, API tooling, and coding agents.
  statuspageJob("bitbucket", "https://bitbucket.status.atlassian.com"),
  statuspageJob("buildkite", "https://www.buildkitestatus.com"),
  statuspageJob("pypi", "https://status.python.org"),
  statuspageJob("rubygems", "https://status.rubygems.org"),
  statuspageJob("maven", "https://status.maven.org"),
  statuspageJob("postman", "https://status.postman.com"),
  statuspageJob("augment", "https://status.augmentcode.com"),
  statuspageJob("factory", "https://status.factory.ai"),
  statuspageJob("tabnine", "https://status.tabnine.com"),
  {
    id: "zed",
    fetch: () => fetchInstatusState("https://status.zed.dev", fetchOptions()),
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
