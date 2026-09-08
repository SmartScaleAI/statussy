import { headers } from "next/headers"

import { auth } from "@/lib/auth"

export type AuthSession = typeof auth.$Infer.Session

/**
 * Server-side session for follow-on work (favorites persistence).
 * Returns null when unauthenticated or when auth/DB is not configured.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
    return null
  }
  try {
    return await auth.api.getSession({
      headers: await headers(),
    })
  } catch (err) {
    console.error("[statussy] getAuthSession failed", err)
    return null
  }
}
