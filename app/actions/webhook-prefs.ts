"use server"

import { unstable_rethrow } from "next/navigation"

import { getSessionUserId } from "@/lib/session-user"
import {
  DEFAULT_WEBHOOK_PREFS,
  getUserWebhookPrefs,
  revealUserWebhookSecret,
  rotateUserWebhookSecret,
  saveUserWebhookUrl,
  sendUserWebhookTest,
  setUserWebhookEnabled,
  type UserWebhookPrefs,
} from "@/lib/user-webhook-prefs"
import { parseWebhookUrl } from "@/lib/webhook"

export type WebhookPrefsState =
  | ({ signedIn: true } & UserWebhookPrefs)
  | { signedIn: false }

export type WebhookSaveState = WebhookPrefsState & {
  secretOnce?: string | null
  error?: string
}

export type WebhookSecretState =
  | ({ signedIn: true } & UserWebhookPrefs & { secretOnce: string })
  | { signedIn: false; error?: string }

export type WebhookRevealState =
  | { signedIn: true; secret: string }
  | { signedIn: false }
  | { signedIn: true; secret: null; error: string }

export type WebhookTestState = WebhookPrefsState & {
  ok: boolean
  error?: string
}

const SIGNED_OUT: WebhookPrefsState = { signedIn: false }

function signedInPrefs(prefs: UserWebhookPrefs | null): WebhookPrefsState {
  return { signedIn: true, ...(prefs ?? DEFAULT_WEBHOOK_PREFS) }
}

export async function getMyWebhookPrefs(): Promise<WebhookPrefsState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const prefs = await getUserWebhookPrefs(userId)
    return signedInPrefs(prefs)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] getMyWebhookPrefs failed", err)
    return SIGNED_OUT
  }
}

export async function saveMyWebhookUrl(
  url: string
): Promise<WebhookSaveState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const parsed = parseWebhookUrl(typeof url === "string" ? url : "")
    if (!parsed.ok) {
      const prefs = await getUserWebhookPrefs(userId)
      return { ...signedInPrefs(prefs), error: parsed.error }
    }
    const result = await saveUserWebhookUrl(userId, parsed.url)
    if (!result) {
      return {
        ...signedInPrefs(await getUserWebhookPrefs(userId)),
        error: "Could not save webhook URL.",
      }
    }
    return {
      ...signedInPrefs(result.prefs),
      secretOnce: result.secretOnce,
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] saveMyWebhookUrl failed", err)
    return SIGNED_OUT
  }
}

export async function setMyWebhookEnabled(
  enabled: boolean
): Promise<WebhookSaveState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const on = Boolean(enabled)
    if (on) {
      const current = await getUserWebhookPrefs(userId)
      if (!current?.url || !current.hasSecret) {
        return {
          ...signedInPrefs(current),
          error: "Save an HTTPS webhook URL first.",
        }
      }
      const parsed = parseWebhookUrl(current.url)
      if (!parsed.ok) {
        return { ...signedInPrefs(current), error: parsed.error }
      }
    }
    const prefs = await setUserWebhookEnabled(userId, on)
    return signedInPrefs(prefs)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] setMyWebhookEnabled failed", err)
    return SIGNED_OUT
  }
}

export async function rotateMyWebhookSecret(): Promise<WebhookSecretState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return { signedIn: false }
    }
    const result = await rotateUserWebhookSecret(userId)
    if (!result) {
      return { signedIn: false, error: "Save a webhook URL first." }
    }
    return {
      signedIn: true,
      ...result.prefs,
      secretOnce: result.secretOnce,
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] rotateMyWebhookSecret failed", err)
    return { signedIn: false }
  }
}

export async function revealMyWebhookSecret(): Promise<WebhookRevealState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return { signedIn: false }
    }
    const secret = await revealUserWebhookSecret(userId)
    if (!secret) {
      return {
        signedIn: true,
        secret: null,
        error: "Save a webhook URL first.",
      }
    }
    return { signedIn: true, secret }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] revealMyWebhookSecret failed", err)
    return { signedIn: false }
  }
}

export async function sendMyWebhookTest(): Promise<WebhookTestState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return { signedIn: false, ok: false }
    }
    const result = await sendUserWebhookTest(userId)
    if (!result.ok) {
      return {
        ...signedInPrefs(result.prefs),
        ok: false,
        error: result.error,
      }
    }
    return { ...signedInPrefs(result.prefs), ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] sendMyWebhookTest failed", err)
    return { signedIn: false, ok: false }
  }
}
