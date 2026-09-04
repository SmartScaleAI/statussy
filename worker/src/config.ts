export type Config = {
  databaseUrl: string
  refreshIntervalSeconds: number
  port: number
  fetchTimeoutMs: number
  fetchUserAgent: string
  /** SMA-23: measured latency probes are optional; set LATENCY_PROBES_ENABLED=false to skip them. */
  latencyProbesEnabled: boolean
  probeTimeoutMs: number
}

const DEFAULT_REFRESH_INTERVAL_SECONDS = 300
const DEFAULT_FETCH_TIMEOUT_MS = 10_000
const DEFAULT_PROBE_TIMEOUT_MS = 5_000
const DEFAULT_FETCH_USER_AGENT =
  "statussy-worker/0.1 (+https://github.com/SmartScaleAI/statussy)"

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required (postgres connection string)")
  }

  let refreshIntervalSeconds = DEFAULT_REFRESH_INTERVAL_SECONDS
  if (env.REFRESH_INTERVAL_SECONDS !== undefined) {
    const parsed = Number(env.REFRESH_INTERVAL_SECONDS)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `REFRESH_INTERVAL_SECONDS must be a positive integer, got ${JSON.stringify(env.REFRESH_INTERVAL_SECONDS)}`,
      )
    }
    refreshIntervalSeconds = parsed
  }

  const port = env.PORT ? Number(env.PORT) : 8080
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got ${JSON.stringify(env.PORT)}`)
  }

  let fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS
  if (env.FETCH_TIMEOUT_MS !== undefined) {
    const parsed = Number(env.FETCH_TIMEOUT_MS)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `FETCH_TIMEOUT_MS must be a positive integer, got ${JSON.stringify(env.FETCH_TIMEOUT_MS)}`,
      )
    }
    fetchTimeoutMs = parsed
  }

  const fetchUserAgent = env.FETCH_USER_AGENT?.trim() || DEFAULT_FETCH_USER_AGENT

  let latencyProbesEnabled = true
  if (env.LATENCY_PROBES_ENABLED !== undefined) {
    const raw = env.LATENCY_PROBES_ENABLED.trim().toLowerCase()
    if (raw === "true" || raw === "1") {
      latencyProbesEnabled = true
    } else if (raw === "false" || raw === "0") {
      latencyProbesEnabled = false
    } else {
      throw new Error(
        `LATENCY_PROBES_ENABLED must be true or false, got ${JSON.stringify(env.LATENCY_PROBES_ENABLED)}`,
      )
    }
  }

  let probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS
  if (env.PROBE_TIMEOUT_MS !== undefined) {
    const parsed = Number(env.PROBE_TIMEOUT_MS)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `PROBE_TIMEOUT_MS must be a positive integer, got ${JSON.stringify(env.PROBE_TIMEOUT_MS)}`,
      )
    }
    probeTimeoutMs = parsed
  }

  return {
    databaseUrl,
    refreshIntervalSeconds,
    port,
    fetchTimeoutMs,
    fetchUserAgent,
    latencyProbesEnabled,
    probeTimeoutMs,
  }
}
