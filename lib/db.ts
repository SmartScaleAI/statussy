import { Pool } from "pg"

import { resolveSsl } from "@/lib/live-status"

declare global {
  // Shared with `lib/live-status.ts` so reads and suggestion writes reuse one pool.
  var __statussyPool: Pool | undefined
}

/** Fail fast instead of hanging a server action on an unreachable database. */
const CONNECT_TIMEOUT_MS = 5_000

/** `host:port/db` for error logs — never includes credentials. */
export function describeDatabaseTarget(): string {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return "<DATABASE_URL unset>"
  }
  try {
    const url = new URL(databaseUrl)
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`
  } catch {
    return "<unparseable DATABASE_URL>"
  }
}

export function getDatabasePool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return null
  }
  globalThis.__statussyPool ??= new Pool({
    connectionString: databaseUrl,
    max: 3,
    ssl: resolveSsl(databaseUrl),
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  })
  return globalThis.__statussyPool
}
