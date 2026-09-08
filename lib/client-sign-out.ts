"use client"

import { invalidateAuthViews } from "@/app/actions/account"
import { authClient } from "@/lib/auth-client"

/**
 * Clear the Better Auth cookie and drop cached account views so header
 * Sign In and /settings cannot diverge after sign-out (SMA-112).
 */
export async function signOutAndInvalidateViews(): Promise<void> {
  await authClient.signOut()
  try {
    await invalidateAuthViews()
  } catch (err) {
    console.error("[statussy] invalidateAuthViews after sign-out failed", err)
  }
}
