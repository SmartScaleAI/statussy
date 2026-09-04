import { Pool } from "pg"

import { resolveSsl } from "@/lib/live-status"
import { toSuggestionTimestamp } from "@/lib/suggest-provider"

declare global {
  // Shared with `lib/live-status.ts` so reads and suggestion writes reuse one pool.
  var __statussyPool: Pool | undefined
}

/** Fail fast instead of hanging a server action on an unreachable database. */
const CONNECT_TIMEOUT_MS = 5_000
const QUERY_TIMEOUT_MS = 8_000

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
  if (globalThis.__statussyPool) {
    return globalThis.__statussyPool
  }
  try {
    // Same SSL policy as board reads (`resolveSsl`): Railway's public TCP proxy
    // presents a self-signed cert, so we encrypt without CA verification.
    globalThis.__statussyPool = new Pool({
      connectionString: databaseUrl,
      max: 3,
      ssl: resolveSsl(databaseUrl),
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      query_timeout: QUERY_TIMEOUT_MS,
    })
    return globalThis.__statussyPool
  } catch (err) {
    console.error(
      `[statussy] failed to create database pool (db=${describeDatabaseTarget()})`,
      err
    )
    return null
  }
}

export async function insertProviderSuggestion(
  name: string,
  email: string | null
): Promise<{ ok: true; createdAt: Date } | { ok: false }> {
  const pool = getDatabasePool()
  if (!pool) {
    return { ok: false }
  }

  try {
    const { rows } = await pool.query<{ created_at: Date }>(
      `INSERT INTO provider_suggestions (name, email)
       VALUES ($1, $2)
       RETURNING created_at`,
      [name, email]
    )
    return {
      ok: true,
      createdAt: toSuggestionTimestamp(rows[0]?.created_at),
    }
  } catch (err) {
    console.error(
      `[statussy] provider suggestion insert failed (db=${describeDatabaseTarget()})`,
      err
    )
    return { ok: false }
  }
}
