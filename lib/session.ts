import { headers } from "next/headers"

import { auth } from "@/lib/auth"

export type ServerSession = Awaited<ReturnType<typeof auth.api.getSession>>

/**
 * Server-side Better Auth session for follow-on work (SMA-104 favorites).
 *
 * Uses `headers()`, so do **not** call this from ISR-cached page renders
 * (SMA-97: board + detail `revalidate = 60`). A cached HTML payload must
 * not embed a user-specific session. Header/star chrome reads the session
 * on the client via `authClient.useSession()`.
 */
export async function getServerSession(): Promise<ServerSession> {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    })
  } catch (err) {
    console.error("[statussy] getServerSession failed", err)
    return null
  }
}
