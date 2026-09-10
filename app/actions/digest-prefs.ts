"use server"

import { unstable_rethrow } from "next/navigation"

import { getSessionUserId } from "@/lib/session-user"
import {
  DEFAULT_DIGEST_PREFS,
  getUserDigestPrefs,
  setUserDigestPrefs,
  type UserDigestPrefs,
} from "@/lib/user-digest-prefs"

export type DigestPrefsState =
  ({ signedIn: true } & UserDigestPrefs) | { signedIn: false }

const SIGNED_OUT: DigestPrefsState = { signedIn: false }

function signedInPrefs(prefs: UserDigestPrefs | null): DigestPrefsState {
  return { signedIn: true, ...(prefs ?? DEFAULT_DIGEST_PREFS) }
}

export async function getMyDigestPrefs(): Promise<DigestPrefsState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const prefs = await getUserDigestPrefs(userId)
    return signedInPrefs(prefs)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] getMyDigestPrefs failed", err)
    return SIGNED_OUT
  }
}

/** Banner CTA: master on, Major on, Partial off. Never enables Partial. */
export async function enableMyDigest(): Promise<DigestPrefsState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const prefs = await setUserDigestPrefs(userId, { emailEnabled: true })
    return signedInPrefs(prefs)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] enableMyDigest failed", err)
    return SIGNED_OUT
  }
}

export async function setMyDigestNotify(
  kind: "major" | "partial",
  enabled: boolean
): Promise<DigestPrefsState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const on = Boolean(enabled)
    const prefs = await setUserDigestPrefs(
      userId,
      kind === "major" ? { notifyMajor: on } : { notifyPartial: on }
    )
    return signedInPrefs(prefs)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] setMyDigestNotify failed", err)
    return SIGNED_OUT
  }
}

export async function dismissDigestBanner(): Promise<DigestPrefsState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const prefs = await setUserDigestPrefs(userId, { bannerDismissed: true })
    return signedInPrefs(prefs)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] dismissDigestBanner failed", err)
    return SIGNED_OUT
  }
}
