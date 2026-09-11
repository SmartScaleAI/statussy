/**
 * Client-safe webhook pref shapes (SMA-137). No Postgres or Node crypto.
 */

export type UserWebhookPrefs = {
  url: string
  enabled: boolean
  hasSecret: boolean
  secretMasked: string | null
  consecutiveFailures: number
  disabledReason: string | null
  lastError: string | null
  disabledNote: string | null
}

export const DEFAULT_WEBHOOK_PREFS: UserWebhookPrefs = {
  url: "",
  enabled: false,
  hasSecret: false,
  secretMasked: null,
  consecutiveFailures: 0,
  disabledReason: null,
  lastError: null,
  disabledNote: null,
}

export function pickWebhookPrefs(prefs: UserWebhookPrefs): UserWebhookPrefs {
  return {
    url: prefs.url,
    enabled: prefs.enabled,
    hasSecret: prefs.hasSecret,
    secretMasked: prefs.secretMasked,
    consecutiveFailures: prefs.consecutiveFailures,
    disabledReason: prefs.disabledReason,
    lastError: prefs.lastError,
    disabledNote: prefs.disabledNote,
  }
}
