/**
 * Top-of-board email opt-in banner visibility (SMA-115 / SMA-118).
 * Signed-out users see it (CTA → login). Signed-in users see it until
 * they enable alerts or dismiss. Not gated on first favorite.
 * This module is client-safe — no Postgres imports.
 */

export type UserDigestPrefs = {
  /** Master opt-in. Banner Enable turns this on. */
  emailEnabled: boolean
  notifyMajor: boolean
  notifyPartial: boolean
  bannerDismissed: boolean
}

export type DigestPrefsPatch = {
  emailEnabled?: boolean
  notifyMajor?: boolean
  notifyPartial?: boolean
  bannerDismissed?: boolean
}

export const DEFAULT_DIGEST_PREFS: UserDigestPrefs = {
  emailEnabled: false,
  notifyMajor: false,
  notifyPartial: false,
  bannerDismissed: false,
}

/** After banner/CTA opt-in: master on, Major on, Partial off. */
export const OPT_IN_DIGEST_PREFS: UserDigestPrefs = {
  emailEnabled: true,
  notifyMajor: true,
  notifyPartial: false,
  bannerDismissed: true,
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

/**
 * Merge a prefs patch. Banner master opt-in (`emailEnabled: true`) applies
 * Major-on / Partial-off unless the patch sets those flags. Turning either
 * notify toggle on also marks master opted-in and dismisses the banner.
 */
export function applyDigestPrefsPatch(
  current: UserDigestPrefs,
  patch: DigestPrefsPatch
): UserDigestPrefs {
  const next: UserDigestPrefs = {
    emailEnabled: patch.emailEnabled ?? current.emailEnabled,
    notifyMajor: patch.notifyMajor ?? current.notifyMajor,
    notifyPartial: patch.notifyPartial ?? current.notifyPartial,
    bannerDismissed: patch.bannerDismissed ?? current.bannerDismissed,
  }
  if (patch.emailEnabled === true) {
    if (patch.notifyMajor === undefined) {
      next.notifyMajor = true
    }
    if (patch.notifyPartial === undefined) {
      next.notifyPartial = false
    }
    next.bannerDismissed = true
  }
  if (patch.notifyMajor === true || patch.notifyPartial === true) {
    next.emailEnabled = true
    next.bannerDismissed = true
  }
  return next
}

export function pickDigestPrefs(prefs: UserDigestPrefs): UserDigestPrefs {
  return {
    emailEnabled: prefs.emailEnabled,
    notifyMajor: prefs.notifyMajor,
    notifyPartial: prefs.notifyPartial,
    bannerDismissed: prefs.bannerDismissed,
  }
}

export type DigestBannerState = {
  authPending: boolean
  signedIn: boolean
  emailEnabled: boolean
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
    !state.emailEnabled &&
    !state.bannerDismissed &&
    !state.localDismissed
  )
}
