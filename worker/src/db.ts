import pg from "pg"

/** Hosts reachable only over trusted private networks — no TLS needed. */
function isPrivateHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".railway.internal")
  )
}

/**
 * SSL config for `pg` from the connection URL. Keep in sync with
 * `lib/live-status.ts` in the app (separate package, same policy).
 *
 * On Railway the worker normally reaches Postgres over the private network
 * (`postgres.railway.internal`) where TLS is unnecessary — that path stays
 * unchanged. But when pointed at the public TCP proxy (`*.proxy.rlwy.net`,
 * e.g. from a local machine), the postgres-ssl image serves a self-signed
 * certificate that fails CA verification, so we encrypt without verification
 * (libpq `sslmode=require` semantics). Passing `ssl` explicitly also
 * sidesteps pg's own `sslmode=require` parsing, which *does* verify and
 * would reject Railway's certificate.
 */
export function resolveSsl(
  databaseUrl: string
): false | { rejectUnauthorized: false } {
  let url: URL
  try {
    url = new URL(databaseUrl)
  } catch {
    // Let pg surface the connection-string error itself.
    return false
  }
  const sslmode = url.searchParams.get("sslmode")
  if (sslmode === "disable") {
    return false
  }
  if (sslmode !== null || !isPrivateHost(url.hostname)) {
    return { rejectUnauthorized: false }
  }
  return false
}

/**
 * Cap on pooled connections. The old max of 3 against ~40 in-flight fetches
 * left most persists waiting to check out a client. `pg-pool` waits forever
 * unless `connectionTimeoutMillis` is set, which pinned the tick.
 *
 * 20 matches the default fetch concurrency: each in-flight slot can hold one
 * connection during persist, without opening one connection per service.
 * Higher `FETCH_CONCURRENCY` still caps here; extra checkouts fail after
 * `POOL_CONNECTION_TIMEOUT_MS` instead of hanging.
 */
export const POOL_MAX = 20

/** Checkout / new-connection wait. Covers a saturated pool, not only TCP. */
export const POOL_CONNECTION_TIMEOUT_MS = 10_000

/**
 * Postgres cancels a statement that runs longer than this (milliseconds,
 * startup parameter). Covers lock wait. The client-side `query_timeout` is
 * slightly longer so a cancel can surface before the driver gives up, and
 * so a query cannot pin a pool slot if that cancel never arrives.
 */
export const POOL_STATEMENT_TIMEOUT_MS = 15_000

export const POOL_QUERY_TIMEOUT_MS = 20_000

export function resolvePoolMax(fetchConcurrency: number): number {
  if (!Number.isInteger(fetchConcurrency) || fetchConcurrency < 1) {
    return POOL_MAX
  }
  return Math.min(fetchConcurrency, POOL_MAX)
}

export function resolvePoolConfig(
  databaseUrl: string,
  fetchConcurrency = POOL_MAX,
): pg.PoolConfig {
  return {
    connectionString: databaseUrl,
    max: resolvePoolMax(fetchConcurrency),
    connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
    statement_timeout: POOL_STATEMENT_TIMEOUT_MS,
    query_timeout: POOL_QUERY_TIMEOUT_MS,
    ssl: resolveSsl(databaseUrl),
  }
}

export function createPool(
  databaseUrl: string,
  fetchConcurrency = POOL_MAX,
): pg.Pool {
  return new pg.Pool(resolvePoolConfig(databaseUrl, fetchConcurrency))
}
