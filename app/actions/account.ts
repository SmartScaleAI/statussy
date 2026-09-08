"use server"

import { headers } from "next/headers"
import { unstable_rethrow } from "next/navigation"

import { auth } from "@/lib/auth"
import { getAuthSession } from "@/lib/auth-session"
import { listLinkedAccounts } from "@/lib/auth-accounts"
import {
  canUnlinkSocialProvider,
  isSocialProvider,
  type SocialProvider,
} from "@/lib/sign-in-methods"
import { deleteUserFavorites } from "@/lib/user-favorites"

export type AccountActionResult =
  { ok: true } | { ok: false; error: "signed-out" | "last-method" | "failed" }

export async function unlinkSocialAccount(
  provider: SocialProvider
): Promise<AccountActionResult> {
  try {
    if (!isSocialProvider(provider)) {
      return { ok: false, error: "failed" }
    }
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return { ok: false, error: "signed-out" }
    }
    const accounts = await listLinkedAccounts()
    if (!canUnlinkSocialProvider(accounts, provider)) {
      return { ok: false, error: "last-method" }
    }
    const account = accounts.find((row) => row.providerId === provider)
    if (!account) {
      return { ok: false, error: "failed" }
    }
    const ctx = await auth.$context
    await ctx.internalAdapter.deleteAccount(account.id)
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] unlinkSocialAccount failed", err)
    return { ok: false, error: "failed" }
  }
}

/**
 * Delete the signed-in user, sessions, and favorites, then return so the
 * client can sign out and send them to the board.
 */
export async function deleteMyAccount(): Promise<AccountActionResult> {
  try {
    const session = await getAuthSession()
    const userId = session?.user?.id
    if (!userId) {
      return { ok: false, error: "signed-out" }
    }
    await deleteUserFavorites(userId)
    try {
      await auth.api.deleteUser({
        body: {},
        headers: await headers(),
      })
    } catch (err) {
      console.error("[statussy] auth.api.deleteUser failed; using adapter", err)
      const ctx = await auth.$context
      await ctx.internalAdapter.deleteUser(userId)
      await ctx.internalAdapter.deleteUserSessions(userId)
    }
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] deleteMyAccount failed", err)
    return { ok: false, error: "failed" }
  }
}
