/**
 * First-star email opt-in banner visibility (SMA-115).
 * Persist dismiss until the user enables alerts (settings or CTA).
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

export type DigestBannerState = {
  signedIn: boolean
  favoriteCount: number
  emailMajorPartial: boolean
  bannerDismissed: boolean
  prefsReady: boolean
  favoritesReady: boolean
}

export function shouldShowDigestBanner(state: DigestBannerState): boolean {
  return (
    state.signedIn &&
    state.favoritesReady &&
    state.prefsReady &&
    state.favoriteCount >= 1 &&
    !state.emailMajorPartial &&
    !state.bannerDismissed
  )
}
