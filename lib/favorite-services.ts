/**
 * Browser-only favorites for the board (SMA-37).
 *
 * Storage keeps insertion order (last-starred appended). `selectFavoriteServices`
 * still returns a stable id-ordered subset; My Services then applies the shared
 * board sort (SMA-40, `statussy:sortBy`).
 */

export const FAVORITE_SERVICE_IDS_KEY = "statussy:favoriteServiceIds"

export type FavoriteServiceRef = {
  id: string
}

export function parseFavoriteServiceIds(raw: string | null): string[] {
  if (!raw) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    const seen = new Set<string>()
    const ids: string[] = []
    for (const value of parsed) {
      if (typeof value !== "string") {
        continue
      }
      const id = value.trim()
      if (!id || seen.has(id)) {
        continue
      }
      seen.add(id)
      ids.push(id)
    }
    return ids
  } catch {
    return []
  }
}

export function serializeFavoriteServiceIds(ids: readonly string[]): string {
  return JSON.stringify(ids)
}

export function toggleFavoriteServiceId(
  ids: readonly string[],
  id: string
): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

/** Favorited services in stable id order. Unknown stored ids are dropped. */
export function selectFavoriteServices<T extends FavoriteServiceRef>(
  items: readonly T[],
  favoriteIds: readonly string[]
): T[] {
  const favorited = new Set(favoriteIds)
  return items
    .filter((item) => favorited.has(item.id))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function writeFavoriteServiceIds(ids: readonly string[]) {
  window.localStorage.setItem(
    FAVORITE_SERVICE_IDS_KEY,
    serializeFavoriteServiceIds(ids)
  )
}
