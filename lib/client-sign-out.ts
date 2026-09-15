"use client"

import { invalidateAuthViews } from "@/app/actions/account"
import { authClient } from "@/lib/auth-client"
import { clearStoredBoardTab } from "@/lib/board-tab"

/**
 * Clear the Better Auth cookie and drop cached account views so header
 * Sign In and /settings cannot diverge after sign-out (SMA-112).
 * Also drop the board-tab cookie so the next homepage SSR is All Services.
 */
export async function signOutAndInvalidateViews(): Promise<void> {
  clearStoredBoardTab()
  await authClient.signOut()
  try {
    await invalidateAuthViews()
  } catch (err) {
    console.error("[statussy] invalidateAuthViews after sign-out failed", err)
  }
}
