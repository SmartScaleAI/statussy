import { headers } from "next/headers"

import { auth, type Session } from "@/lib/auth"

export type { Session }

/**
 * Server-side session for follow-on work (favorites persistence).
 * Returns null when there is no cookie, the DB is unreachable, or auth
 * is not configured — callers must not treat that as an error.
 */
export async function getSession(): Promise<Session | null> {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    })
  } catch {
    return null
  }
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}
