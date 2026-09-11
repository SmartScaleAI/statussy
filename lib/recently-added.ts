/**
 * Recently added rail (SMA-123): six newest catalog services by first-seen
 * `services.created_at`. Seed upserts do not overwrite that column, so it
 * stays the insert timestamp. No invented dates — missing/invalid rows drop
 * out; an empty or unreachable DB yields an empty list.
 */

import { services } from "../data/services.ts"

export const RECENTLY_ADDED_LIMIT = 6

export type RecentlyAddedService = {
  id: string
  name: string
  createdAt: Date
}

export type RecentlyAddedRow = {
  id: string
  name: string
  createdAt: unknown
}

/** Human date for the rail, e.g. `Sep 10, 2026`. UTC, same as other stamps. */
export function formatAddedDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/** Accept Date / ISO from pg; reject junk instead of inventing a fallback. */
export function toAddedTimestamp(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }
  return null
}

/**
 * Keep catalog services only, newest first. Catalog `name` wins so the row
 * matches the board / detail page. Caller may already LIMIT; we still cap.
 */
export function selectRecentlyAdded(
  rows: RecentlyAddedRow[],
  catalogNames: ReadonlyMap<string, string>,
  limit = RECENTLY_ADDED_LIMIT
): RecentlyAddedService[] {
  const items: RecentlyAddedService[] = []
  for (const row of rows) {
    const name = catalogNames.get(row.id)
    const createdAt = toAddedTimestamp(row.createdAt)
    if (!name || !createdAt) {
      continue
    }
    items.push({ id: row.id, name, createdAt })
  }
  items.sort((a, b) => {
    const delta = b.createdAt.getTime() - a.createdAt.getTime()
    if (delta !== 0) {
      return delta
    }
    return a.id.localeCompare(b.id)
  })
  return items.slice(0, limit)
}

export function catalogNameById(): Map<string, string> {
  return new Map(services.map((service) => [service.id, service.name]))
}

export async function listRecentlyAddedServices(): Promise<
  RecentlyAddedService[]
> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return []
  }

  const catalogNames = catalogNameById()
  const catalogIds = [...catalogNames.keys()]
  if (catalogIds.length === 0) {
    return []
  }

  try {
    const { rows } = await pool.query<{
      id: string
      name: string
      created_at: Date
    }>(
      `SELECT id, name, created_at
         FROM services
        WHERE id = ANY($1::text[])
        ORDER BY created_at DESC, id ASC
        LIMIT $2`,
      [catalogIds, RECENTLY_ADDED_LIMIT]
    )
    return selectRecentlyAdded(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
      })),
      catalogNames
    )
  } catch (err) {
    console.error(
      `[statussy] recently added read failed (db=${describeDatabaseTarget()})`,
      err
    )
    return []
  }
}
