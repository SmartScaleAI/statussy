/**
 * Client-safe board sort (SMA-40). Filter first (search ∧ category), then sort
 * the visible set. Same helpers apply to All Services and My Services.
 *
 * Issues first: a service ranks in the issues group when its overall status is
 * not `operational`, or `hasActiveIncident` is true (board maps this from a
 * non-empty `incidentTitle` — the live snapshot / mock incident line). Fully
 * operational services with no incident rank below. Within a group, Name A–Z.
 *
 * Name A–Z: `localeCompare` on `name`.
 * Health %: lowest resolved percent first; ties by Name A–Z. Missing live
 * health uses the worker fallback — 100 when operational, otherwise 0.
 */

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

/** `formatHealth` strings like "94.1%" → 94.1; junk / empty → null. */
export function parseHealthLabel(
  label: string | null | undefined
): number | null {
  if (!label) {
    return null
  }
  const n = Number.parseFloat(label)
  return Number.isFinite(n) ? n : null
}

export function serviceHasIssues(item: {
  status: string
  hasActiveIncident: boolean
}): boolean {
  return item.status !== "operational" || item.hasActiveIncident
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
    const issueDelta = Number(serviceHasIssues(b)) - Number(serviceHasIssues(a))
    if (issueDelta !== 0) {
      return issueDelta
    }
    return byName(a, b)
  })
}
