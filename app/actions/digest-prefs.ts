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

export async function getMyDigestPrefs(): Promise<DigestPrefsState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const prefs = await getUserDigestPrefs(userId)
    return { signedIn: true, ...(prefs ?? DEFAULT_DIGEST_PREFS) }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] getMyDigestPrefs failed", err)
    return SIGNED_OUT
  }
}

export async function setMyDigestEmail(
  enabled: boolean
): Promise<DigestPrefsState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const prefs = await setUserDigestPrefs(userId, {
      emailMajorPartial: Boolean(enabled),
    })
    return { signedIn: true, ...(prefs ?? DEFAULT_DIGEST_PREFS) }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] setMyDigestEmail failed", err)
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
    return { signedIn: true, ...(prefs ?? DEFAULT_DIGEST_PREFS) }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] dismissDigestBanner failed", err)
    return SIGNED_OUT
  }
}
