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

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    max: 3,
    ssl: resolveSsl(databaseUrl),
  })
}
