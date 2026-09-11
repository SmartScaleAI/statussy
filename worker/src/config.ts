export type ResendMailConfig = {
  apiKey: string
  from: string
}

/** Verified Resend domain + display name so Mail shows Statussy, not the raw address. */
export const DEFAULT_RESEND_FROM = "Statussy <noreply@statussy.com>"

/**
 * Digest From: Statussy display name on @statussy.com.
 * Empty env and any smartaiscaling.com address fall back to the default.
 */
export function resolveDigestFrom(raw: string | undefined | null): string {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed || /smartaiscaling\.com/i.test(trimmed)) {
    return DEFAULT_RESEND_FROM
  }
  if (/^[^<>\s]+@[^<>\s]+$/.test(trimmed)) {
    return `Statussy <${trimmed}>`
  }
  return trimmed
}

export type Config = {
  databaseUrl: string
  refreshIntervalSeconds: number
  port: number
  fetchTimeoutMs: number
  fetchUserAgent: string
  /** Max in-flight service fetches per tick (SMA-100). */
  fetchConcurrency: number
  /** Random 0..N ms delay before each fetch starts, to smooth bursts. */
  fetchJitterMs: number
  /** Optional. Worker skip-sends digests when RESEND_API_KEY is unset (SMA-115). */
  resend: ResendMailConfig | null
  /** Public board origin used in digest links. */
  publicSiteUrl: string
}

const DEFAULT_REFRESH_INTERVAL_SECONDS = 300
const DEFAULT_FETCH_TIMEOUT_MS = 10_000
const DEFAULT_FETCH_CONCURRENCY = 40
const DEFAULT_FETCH_JITTER_MS = 250
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
        `REFRESH_INTERVAL_SECONDS must be a positive integer, got ${JSON.stringify(env.REFRESH_INTERVAL_SECONDS)}`
      )
    }
    refreshIntervalSeconds = parsed
  }

  const port = env.PORT ? Number(env.PORT) : 8080
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `PORT must be a positive integer, got ${JSON.stringify(env.PORT)}`
    )
  }

  let fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS
  if (env.FETCH_TIMEOUT_MS !== undefined) {
    const parsed = Number(env.FETCH_TIMEOUT_MS)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `FETCH_TIMEOUT_MS must be a positive integer, got ${JSON.stringify(env.FETCH_TIMEOUT_MS)}`
      )
    }
    fetchTimeoutMs = parsed
  }

  const fetchUserAgent =
    env.FETCH_USER_AGENT?.trim() || DEFAULT_FETCH_USER_AGENT

  let fetchConcurrency = DEFAULT_FETCH_CONCURRENCY
  if (env.FETCH_CONCURRENCY !== undefined) {
    const parsed = Number(env.FETCH_CONCURRENCY)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `FETCH_CONCURRENCY must be a positive integer, got ${JSON.stringify(env.FETCH_CONCURRENCY)}`
      )
    }
    fetchConcurrency = parsed
  }

  let fetchJitterMs = DEFAULT_FETCH_JITTER_MS
  if (env.FETCH_JITTER_MS !== undefined) {
    const parsed = Number(env.FETCH_JITTER_MS)
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(
        `FETCH_JITTER_MS must be a non-negative integer, got ${JSON.stringify(env.FETCH_JITTER_MS)}`
      )
    }
    fetchJitterMs = parsed
  }

  return {
    databaseUrl,
    refreshIntervalSeconds,
    port,
    fetchTimeoutMs,
    fetchUserAgent,
    fetchConcurrency,
    fetchJitterMs,
    resend: resolveResendConfig(env),
    publicSiteUrl: resolvePublicSiteUrl(env),
  }
}

function resolveResendConfig(env: NodeJS.ProcessEnv): ResendMailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim() ?? ""
  if (!apiKey) {
    return null
  }
  return {
    apiKey,
    from: resolveDigestFrom(env.RESEND_FROM ?? env.RESEND_FROM_EMAIL),
  }
}

function resolvePublicSiteUrl(env: NodeJS.ProcessEnv): string {
  const raw = (
    env.STATUSSY_URL ??
    env.BETTER_AUTH_URL ??
    "https://www.statussy.com"
  ).trim()
  return raw.replace(/\/$/, "") || "https://www.statussy.com"
}
