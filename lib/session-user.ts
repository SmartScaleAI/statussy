/**
 * Resolve the signed-in Better Auth user id (SMA-103 session).
 * Used by My Stack server actions — never accept a client-supplied user id.
 */

import { cache } from "react"

import {
  parseUserId,
  readBetterAuthSessionToken,
  resolveAuthBaseUrl,
  parseBetterAuthSessionUserId,
} from "@/lib/auth-session"
import { describeDatabaseTarget, getDatabasePool } from "@/lib/db"

async function lookupSessionUserIdFromDb(
  token: string
): Promise<string | null> {
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }

  // Better Auth's default Kysely/pg schema quotes camelCase columns.
  // A snake_case adapter is the fallback if SMA-103 maps names.
  const queries = [
    `SELECT "userId" AS user_id
       FROM "session"
      WHERE "token" = $1
        AND "expiresAt" > now()
      LIMIT 1`,
    `SELECT user_id
       FROM session
      WHERE token = $1
        AND expires_at > now()
      LIMIT 1`,
  ]

  for (const sql of queries) {
    try {
      const { rows } = await pool.query<{ user_id: string }>(sql, [token])
      const userId = parseUserId(rows[0]?.user_id)
      if (userId) {
        return userId
      }
    } catch {
      // Try the next column-name shape.
    }
  }
  return null
}

async function lookupSessionUserIdFromRoute(
  cookieHeader: string,
  headerStore: Headers
): Promise<string | null> {
  const baseUrl = resolveAuthBaseUrl(headerStore)
  if (!baseUrl) {
    return null
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const res = await fetch(`${baseUrl}/api/auth/get-session`, {
      headers: {
        cookie: cookieHeader,
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    })
    if (!res.ok) {
      return null
    }
    return parseBetterAuthSessionUserId(await res.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Signed-in Better Auth user id, or null when signed out / session unknown.
 * Cached per request so list + toggle share one lookup.
 */
export const getSessionUserId = cache(
  async function getSessionUserId(): Promise<string | null> {
    const { headers } = await import("next/headers")
    const headerStore = await headers()
    const cookieHeader = headerStore.get("cookie")
    const token = readBetterAuthSessionToken(cookieHeader)
    if (!token || !cookieHeader) {
      return null
    }

    try {
      const fromDb = await lookupSessionUserIdFromDb(token)
      if (fromDb) {
        return fromDb
      }
      return await lookupSessionUserIdFromRoute(cookieHeader, headerStore)
    } catch (err) {
      console.error(
        `[statussy] session lookup failed (db=${describeDatabaseTarget()})`,
        err
      )
      return null
    }
  }
)
