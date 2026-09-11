/**
 * Sitewide beta notice (SMA-125). Dismiss persists in localStorage so
 * the banner does not nag on every visit. This module is client-safe.
 */

/** Locked copy. No em dashes or en dashes used as punctuation. */
export const BETA_BANNER_LEAD =
  "Statussy is in beta. Statuses can be wrong or delayed."
export const BETA_BANNER_REPORT = "Report issues in the side panel."
export const BETA_BANNER_COPY = `${BETA_BANNER_LEAD} ${BETA_BANNER_REPORT}`

export const BETA_BANNER_DISMISS_KEY = "statussy.beta-banner-dismissed"

export const BETA_BANNER_REPORT_HREF = "/#report-suggest"

export function readBetaBannerDismissed(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  try {
    return window.localStorage.getItem(BETA_BANNER_DISMISS_KEY) === "1"
  } catch {
    return false
  }
}

export function persistBetaBannerDismissed(dismissed: boolean): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    if (dismissed) {
      window.localStorage.setItem(BETA_BANNER_DISMISS_KEY, "1")
    } else {
      window.localStorage.removeItem(BETA_BANNER_DISMISS_KEY)
    }
  } catch {
    // Private mode / blocked storage — in-memory flag still hides this visit.
  }
}

export type BetaBannerState = {
  storageReady: boolean
  dismissed: boolean
}

export function shouldShowBetaBanner(state: BetaBannerState): boolean {
  return state.storageReady && !state.dismissed
}
