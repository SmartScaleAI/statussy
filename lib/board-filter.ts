export const ALL_CATEGORY = "all"

/** Query param carrying the active board category (SMA-89). */
export const CATEGORY_PARAM = "category"

/**
 * Normalize a raw `?category=` value to a known category slug. Anything
 * unknown (missing, repeated, or not in the registry) falls back to All.
 */
export function parseCategoryParam(
  raw: string | string[] | null | undefined,
  categories: string[]
): string {
  return typeof raw === "string" && categories.includes(raw)
    ? raw
    : ALL_CATEGORY
}

/** Board URL that restores the given category filter; All is the bare board. */
export function boardHref(category: string): string {
  return category === ALL_CATEGORY
    ? "/"
    : `/?${CATEGORY_PARAM}=${encodeURIComponent(category)}`
}

/** Client-safe slice of a board card — no live-status / pg imports. */
export type BoardFilterItem = {
  id: string
  name: string
  category: string
  status: string
}

/** Distinct registry categories, sorted, for the chiclet row (All is separate). */
export function distinctCategories(items: { category: string }[]): string[] {
  return [...new Set(items.map((item) => item.category))].sort((a, b) =>
    a.localeCompare(b)
  )
}

export function formatCategoryLabel(category: string): string {
  if (category === ALL_CATEGORY) {
    return "All"
  }
  if (category.length <= 3) {
    return category.toUpperCase()
  }
  return category.charAt(0).toUpperCase() + category.slice(1)
}

/**
 * Case-insensitive name substring. Empty/whitespace query keeps the list.
 * Shared by All Services (after category) and My Stack (favorites only).
 */
export function filterServicesByName<T extends { name: string }>(
  items: readonly T[],
  query: string
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return [...items]
  }
  return items.filter((item) => item.name.toLowerCase().includes(needle))
}

/**
 * Board visibility: search query ∧ category.
 * All = every service; a category chiclet matches `item.category`.
 */
export function filterBoardServices<
  T extends { name: string; category: string },
>(items: T[], query: string, category: string): T[] {
  const scoped =
    category === ALL_CATEGORY
      ? items
      : items.filter((item) => item.category === category)
  return filterServicesByName(scoped, query)
}

/** Metrics for the currently visible All Services set (search ∧ category). */
export function summarizeBoardItems(items: { status: string }[]) {
  const operational = items.filter(
    (item) => item.status === "operational"
  ).length
  return {
    total: items.length,
    operational,
    issues: items.length - operational,
  }
}
