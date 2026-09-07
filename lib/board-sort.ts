/**
 * Client-safe board sort (SMA-40). Filter first (search ∧ category), then sort
 * the visible set. Same helpers apply to All Services and My Stack.
 *
 * Issues first (SMA-80): status severity rank first (`STATUS_RANK` — Major →
 * Partial → Degraded → Maintenance → Unknown → Live). When status ties,
 * `hasActiveIncident` true sorts before false, so an operational card with an
 * active incident (board maps this from a non-empty `incidentTitle`) still
 * ranks just above fully healthy rows. Then Name A–Z.
 *
 * Name A–Z: `localeCompare` on `name`.
 * Health %: lowest resolved percent first; ties by Name A–Z. Services with no
 * component-health percent (no-grid incident chicklet modes, mock fallback)
 * rank as 100 when operational, otherwise 0.
 */

import { STATUS_RANK, type BoardStatus } from "./status.ts"

export const SORT_BY_KEY = "statussy:sortBy"

export const SORT_BY_VALUES = ["issues-first", "name", "health"] as const

export type SortBy = (typeof SORT_BY_VALUES)[number]

export const DEFAULT_SORT_BY: SortBy = "issues-first"

export const SORT_BY_LABEL: Record<SortBy, string> = {
  "issues-first": "Issues first",
  name: "Name A–Z",
  health: "Health %",
}

/** Client-safe sort fields — no live-status / pg imports. */
export type BoardSortItem = {
  id: string
  name: string
  status: string
  healthPct: number | null
  hasActiveIncident: boolean
}

export function isSortBy(value: unknown): value is SortBy {
  return (
    typeof value === "string" &&
    (SORT_BY_VALUES as readonly string[]).includes(value)
  )
}

/** Invalid or missing storage → Issues first (first-visit default). */
export function parseSortBy(raw: string | null | undefined): SortBy {
  return isSortBy(raw) ? raw : DEFAULT_SORT_BY
}

export function serviceHasIssues(item: {
  status: string
  hasActiveIncident: boolean
}): boolean {
  return item.status !== "operational" || item.hasActiveIncident
}

/** Unrecognized status strings rank as `unknown` (between maintenance and Live). */
export function resolveStatusRank(status: string): number {
  return STATUS_RANK[status as BoardStatus] ?? STATUS_RANK.unknown
}

export function resolveSortHealth(item: {
  status: string
  healthPct: number | null
}): number {
  if (item.healthPct != null && Number.isFinite(item.healthPct)) {
    return item.healthPct
  }
  return item.status === "operational" ? 100 : 0
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name)
}

export function sortBoardServices<T extends BoardSortItem>(
  items: readonly T[],
  sortBy: SortBy
): T[] {
  return [...items].sort((a, b) => {
    if (sortBy === "name") {
      return byName(a, b)
    }
    if (sortBy === "health") {
      const health = resolveSortHealth(a) - resolveSortHealth(b)
      if (health !== 0) {
        return health
      }
      return byName(a, b)
    }
    const rank = resolveStatusRank(a.status) - resolveStatusRank(b.status)
    if (rank !== 0) {
      return rank
    }
    const incident = Number(b.hasActiveIncident) - Number(a.hasActiveIncident)
    if (incident !== 0) {
      return incident
    }
    return byName(a, b)
  })
}
