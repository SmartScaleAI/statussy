"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { unstable_rethrow } from "next/navigation"

import { auth } from "@/lib/auth"
import { getAuthSession } from "@/lib/auth-session"
import { listLinkedAccounts } from "@/lib/auth-accounts"
import {
  canUnlinkSocialProvider,
  isSocialProvider,
  type LinkedAccount,
  type SocialProvider,
} from "@/lib/sign-in-methods"
import { deleteUserDigestPrefs } from "@/lib/user-digest-prefs"
import { deleteUserFavorites } from "@/lib/user-favorites"

export type AccountActionResult =
  { ok: true } | { ok: false; error: "signed-out" | "last-method" | "failed" }

export type AccountSnapshotResult =
  | { ok: true; email: string; accounts: LinkedAccount[] }
  | { ok: false; error: "signed-out" }

/**
 * Live session snapshot for /settings. Never return PII without a current
 * cookie — client-cached props from a previous visit are not trusted.
 */
export async function getMyAccountSnapshot(): Promise<AccountSnapshotResult> {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return { ok: false, error: "signed-out" }
    }
    const accounts = await listLinkedAccounts()
    return {
      ok: true,
      email: session.user.email ?? "",
      accounts,
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] getMyAccountSnapshot failed", err)
    return { ok: false, error: "signed-out" }
  }
}

/** Drop cached /settings (and layout) after sign-out or account deletion. */
export async function invalidateAuthViews(): Promise<void> {
  revalidatePath("/settings")
  revalidatePath("/", "layout")
}

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
    await deleteUserDigestPrefs(userId)
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
    await invalidateAuthViews()
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] deleteMyAccount failed", err)
    return { ok: false, error: "failed" }
  }
}
