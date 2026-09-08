/**
 * Resolve the signed-in Better Auth user id (SMA-103 `getAuthSession`).
 * Used by My Stack server actions — never accept a client-supplied user id.
 */

import { cache } from "react"

import { getAuthSession } from "@/lib/auth-session"

/**
 * Signed-in Better Auth user id, or null when signed out / session unknown.
 * Cached per request so list + toggle share one lookup.
 */
export const getSessionUserId = cache(
  async function getSessionUserId(): Promise<string | null> {
    const session = await getAuthSession()
    const userId = session?.user?.id
    return typeof userId === "string" && userId.trim() ? userId.trim() : null
  }
)
