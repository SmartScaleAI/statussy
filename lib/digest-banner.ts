/**
 * Top-of-board email opt-in banner visibility (SMA-115).
 * Signed-out users see it (CTA → login). Signed-in users see it until
 * they enable alerts or dismiss. Not gated on first favorite.
 * This module is client-safe — no Postgres imports.
 */

export type UserDigestPrefs = {
  emailMajorPartial: boolean
  bannerDismissed: boolean
}

export const DEFAULT_DIGEST_PREFS: UserDigestPrefs = {
  emailMajorPartial: false,
  bannerDismissed: false,
}

/** localStorage key for signed-out (and cross-session) dismiss. */
export const DIGEST_BANNER_DISMISS_KEY =
  "statussy.email-alerts-banner-dismissed"

export function readLocalBannerDismissed(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  try {
    return window.localStorage.getItem(DIGEST_BANNER_DISMISS_KEY) === "1"
  } catch {
    return false
  }
}

export function persistLocalBannerDismissed(dismissed: boolean): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    if (dismissed) {
      window.localStorage.setItem(DIGEST_BANNER_DISMISS_KEY, "1")
    } else {
      window.localStorage.removeItem(DIGEST_BANNER_DISMISS_KEY)
    }
  } catch {
    // Private mode / blocked storage — in-memory flag still hides this visit.
  }
}

export type DigestBannerState = {
  authPending: boolean
  signedIn: boolean
  emailMajorPartial: boolean
  bannerDismissed: boolean
  prefsReady: boolean
  localDismissed: boolean
  storageReady: boolean
}

export function shouldShowDigestBanner(state: DigestBannerState): boolean {
  if (state.authPending) {
    return false
  }
  if (!state.signedIn) {
    return state.storageReady && !state.localDismissed
  }
  return (
    state.prefsReady &&
    !state.emailMajorPartial &&
    !state.bannerDismissed &&
    !state.localDismissed
  )
}
