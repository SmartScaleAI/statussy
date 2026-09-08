import "server-only"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"

/**
 * Server-side session for follow-on work (favorites persist in SMA-104).
 * Do not call this from ISR-cached pages (SMA-97) — `headers()` would force
 * those routes dynamic. Header chrome reads the session on the client.
 */
export async function getServerSession() {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    })
  } catch (err) {
    console.error("[statussy] getServerSession failed", err)
    return null
  }
}

export type ServerSession = Awaited<ReturnType<typeof getServerSession>>
