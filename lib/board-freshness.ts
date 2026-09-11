/**
 * Board-level freshness (SMA-83).
 *
 * The board's `refreshedAt` is the newest successful snapshot fetch across
 * live services — "when did the worker last land board data?" — not page
 * render time. The UI shows its relative age (`Updated 2m ago`) as the quiet
 * up signal; absolute UTC and the poll cadence live in the tooltip only.
 * When the age exceeds `BOARD_STALE_AFTER_MS` the board fails loud
 * (`Updates delayed`) instead of silently showing an old clock.
 *
 * Import-free on purpose: client-safe, and runnable under
 * `node --test` without path-alias resolution (same policy as the other
 * tested lib modules).
 */

/** Worker cron interval — a healthy board gets new snapshots about this often. */
export const POLL_INTERVAL_MS = 5 * 60 * 1000

/**
 * Board data is stale after 3 missed poll ticks (15 minutes). Matches the
 * per-snapshot `STALE_AFTER_MS` in `lib/live-status.ts`, which is derived
 * from this constant — one threshold for "the worker stopped delivering".
 */
export const BOARD_STALE_AFTER_MS = 3 * POLL_INTERVAL_MS

/** True when the last successful board update is older than the threshold. */
export function isBoardStale(refreshedAtIso: string, now = Date.now()) {
  return now - new Date(refreshedAtIso).getTime() > BOARD_STALE_AFTER_MS
}

/**
 * Glance copy for the visible stamp: "just now" under a minute, then
 * "Xm ago" / "Xh ago" / "Xd ago". Clock skew (future timestamps) clamps
 * to "just now" rather than showing a negative age.
 */
export function formatRelativeAge(refreshedAtIso: string, now = Date.now()) {
  const ageMs = Math.max(0, now - new Date(refreshedAtIso).getTime())
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1) {
    return "just now"
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  return `${Math.floor(hours / 24)}d ago`
}

const UTC_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/**
 * Absolute UTC stamp for hydrating tooltips / titles.
 *
 * Built from UTC getters instead of `Intl.DateTimeFormat`. Node ICU and
 * Chrome ICU disagree on the date/time conjunction for the same instant
 * (`Sep 11, 9:38 PM UTC` vs `Sep 11 at 9:38 PM UTC`), which trips React
 * hydration on `title` attributes (SMA-139).
 *
 * Example: `Sep 11, 9:38 PM UTC`
 */
export function formatUtcStamp(iso: string) {
  const date = new Date(iso)
  const month = UTC_MONTHS[date.getUTCMonth()]
  const day = date.getUTCDate()
  const hour24 = date.getUTCHours()
  const minute = String(date.getUTCMinutes()).padStart(2, "0")
  const period = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 || 12
  return `${month} ${day}, ${hour12}:${minute} ${period} UTC`
}

/**
 * Tooltip / `title` copy: absolute UTC time plus the poll cadence, replacing
 * the cut always-visible interval chip (Avery UX lock #2).
 */
export function boardFreshnessTitle(refreshedAtIso: string) {
  const intervalMin = POLL_INTERVAL_MS / 60_000
  return `Last board update ${formatUtcStamp(refreshedAtIso)} · polls about every ${intervalMin} min`
}
