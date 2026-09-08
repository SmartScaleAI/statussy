/**
 * Railway Postgres My Stack stars (SMA-104).
 * Always scoped by the Better Auth user id from the session — never a
 * client-supplied user id.
 */

import { services } from "../data/services.ts"

const CATALOG_IDS = new Set(services.map((service) => service.id))

export function isCatalogServiceId(id: string): boolean {
  return CATALOG_IDS.has(id)
}

export function parseServiceId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const id = value.trim()
  if (!id || !CATALOG_IDS.has(id)) {
    return null
  }
  return id
}

export async function listUserFavoriteIds(
  userId: string
): Promise<string[] | null> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }

  try {
    const { rows } = await pool.query<{ service_id: string }>(
      `SELECT service_id
         FROM user_favorites
        WHERE user_id = $1
        ORDER BY created_at ASC, service_id ASC`,
      [userId]
    )
    return rows
      .map((row) => parseServiceId(row.service_id))
      .filter((id): id is string => id != null)
  } catch (err) {
    console.error(
      `[statussy] list user favorites failed (db=${describeDatabaseTarget()})`,
      err
    )
    return null
  }
}

export async function toggleUserFavorite(
  userId: string,
  serviceId: string
): Promise<string[] | null> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }

  let client: import("pg").PoolClient
  try {
    client = await pool.connect()
  } catch (err) {
    console.error(
      `[statussy] toggle user favorite connect failed (db=${describeDatabaseTarget()})`,
      err
    )
    return null
  }

  try {
    await client.query("BEGIN")
    const deleted = await client.query(
      `DELETE FROM user_favorites
        WHERE user_id = $1 AND service_id = $2`,
      [userId, serviceId]
    )
    if ((deleted.rowCount ?? 0) === 0) {
      await client.query(
        `INSERT INTO user_favorites (user_id, service_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, service_id) DO NOTHING`,
        [userId, serviceId]
      )
    }
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error(
      `[statussy] toggle user favorite failed (db=${describeDatabaseTarget()})`,
      err
    )
    client.release()
    return null
  }
  client.release()
  return listUserFavoriteIds(userId)
}
