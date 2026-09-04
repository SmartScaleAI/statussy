/**
 * Server-side reads from the Statussy Postgres (SMA-15/16 worker schema).
 * Only ever imported from Server Components — `pg` and `DATABASE_URL` must
 * never reach the client bundle.
 *
 * Fallback policy (SMA-18): providers with no snapshot rows keep their prior
 * mock entry from `data/services.ts`. A snapshot whose status is `unknown`
 * (worker's failed-first-fetch marker) renders as an "Unknown" card. When the
 * database is unreachable or `DATABASE_URL` is unset, the whole board falls
 * back to mock.
 */
import { Pool } from "pg"

import type { ServiceStatus } from "@/data/services"

/** Board-facing status: worker enum adds 'unknown' on failed first fetch. */
export type LiveStatus = ServiceStatus | "unknown"

export type LiveSnapshot = {
  providerId: string
  status: LiveStatus
  incidentTitle: string | null
  /** Worker marked the latest snapshot stale after a failed fetch. */
  stale: boolean
  fetchedAt: Date
  /** Non-stale snapshots in the uptime window; null when none exist yet. */
  uptime: { up: number; total: number } | null
}

const LIVE_STATUSES: readonly LiveStatus[] = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
  "unknown",
]

/** Worker cron runs every 5m — 3 missed ticks means the data is stale. */
export const STALE_AFTER_MS = 15 * 60 * 1000

/** Rolling window used to derive the uptime chicklet from snapshots. */
const UPTIME_WINDOW = "24 hours"

type SnapshotRow = {
  provider_id: string
  status: string
  incident_title: string | null
  stale: boolean
  fetched_at: Date
  up: string | null
  total: string | null
}

declare global {
  // Singleton pool that survives dev HMR reloads.
  var __statussyPool: Pool | undefined
}

function getPool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return null
  }
  globalThis.__statussyPool ??= new Pool({
    connectionString: databaseUrl,
    max: 3,
  })
  return globalThis.__statussyPool
}

function toLiveStatus(status: string): LiveStatus {
  return LIVE_STATUSES.includes(status as LiveStatus)
    ? (status as LiveStatus)
    : "unknown"
}

/**
 * Latest snapshot per provider plus a snapshot-derived uptime ratio over the
 * last 24h (share of non-stale snapshots reporting 'operational' — a board
 * heuristic, not a vendor SLA). Returns an empty map when no database is
 * configured or the read fails, so the board can fall back to mock data.
 */
export async function getLiveSnapshots(): Promise<Map<string, LiveSnapshot>> {
  const pool = getPool()
  if (!pool) {
    return new Map()
  }

  try {
    const { rows } = await pool.query<SnapshotRow>(
      `WITH latest AS (
         SELECT DISTINCT ON (provider_id)
                provider_id, status::text AS status, incident_title, stale, fetched_at
         FROM provider_snapshots
         ORDER BY provider_id, fetched_at DESC, id DESC
       ),
       uptime AS (
         SELECT provider_id,
                count(*) FILTER (WHERE status = 'operational') AS up,
                count(*) AS total
         FROM provider_snapshots
         WHERE NOT stale AND fetched_at > now() - interval '${UPTIME_WINDOW}'
         GROUP BY provider_id
       )
       SELECT l.provider_id, l.status, l.incident_title, l.stale, l.fetched_at,
              u.up, u.total
       FROM latest l
       LEFT JOIN uptime u USING (provider_id)`
    )

    const snapshots = new Map<string, LiveSnapshot>()
    for (const row of rows) {
      const total = Number(row.total ?? 0)
      snapshots.set(row.provider_id, {
        providerId: row.provider_id,
        status: toLiveStatus(row.status),
        incidentTitle: row.incident_title,
        stale: row.stale,
        fetchedAt: row.fetched_at,
        uptime: total > 0 ? { up: Number(row.up ?? 0), total } : null,
      })
    }
    return snapshots
  } catch (err) {
    console.error("[statussy] live snapshot read failed, using mock data", err)
    return new Map()
  }
}

/** Stale when the worker flagged it or the snapshot is past the threshold. */
export function isSnapshotStale(snapshot: LiveSnapshot, now = Date.now()) {
  return (
    snapshot.stale || now - snapshot.fetchedAt.getTime() > STALE_AFTER_MS
  )
}
