export const ALL_CATEGORY = "all"

/** Client-safe slice of a board card — no live-status / pg imports. */
export type BoardFilterItem = {
  id: string
  name: string
  category: string
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
 * Board visibility: search query ∧ category.
 * All = every service; a category chiclet matches `item.category`.
 */
export function filterBoardServices<
  T extends { name: string; category: string },
>(items: T[], query: string, category: string): T[] {
  const needle = query.trim().toLowerCase()
  return items.filter((item) => {
    if (category !== ALL_CATEGORY && item.category !== category) {
      return false
    }
    if (needle && !item.name.toLowerCase().includes(needle)) {
      return false
    }
    return true
  })
}
