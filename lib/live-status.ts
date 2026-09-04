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
  /**
   * Measured probe latency (SMA-23): Statussy's own round-trip measurement,
   * independent of official vendor status. Null = no measurement this tick.
   */
  latencyMs: number | null
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
  latency_ms: number | null
  up: string | null
  total: string | null
}

declare global {
  // Singleton pool that survives dev HMR reloads.
  var __statussyPool: Pool | undefined
}

/** Fail fast instead of hanging a server render on an unreachable database. */
const CONNECT_TIMEOUT_MS = 5_000

/** Hosts reachable only over trusted private networks — no TLS needed. */
function isPrivateHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".railway.internal")
  )
}

/**
 * SSL config for `pg` from the connection URL. Keep in sync with
 * `worker/src/db.ts` (separate package, same policy).
 *
 * Railway's public TCP proxy (`*.proxy.rlwy.net` — what Vercel must use)
 * serves a self-signed certificate, so full CA verification fails. We encrypt
 * without verification (libpq `sslmode=require` semantics) for any non-private
 * host. Passing `ssl` explicitly also sidesteps pg's own `sslmode=require`
 * parsing, which *does* verify and would reject Railway's certificate.
 */
export function resolveSsl(
  databaseUrl: string
): false | { rejectUnauthorized: false } {
  let url: URL
  try {
    url = new URL(databaseUrl)
  } catch {
    // Let pg surface the connection-string error itself.
    return false
  }
  const sslmode = url.searchParams.get("sslmode")
  if (sslmode === "disable") {
    return false
  }
  if (sslmode !== null || !isPrivateHost(url.hostname)) {
    return { rejectUnauthorized: false }
  }
  return false
}

/** `host:port/db` for error logs — never includes credentials. */
function describeDatabaseTarget(): string {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return "<DATABASE_URL unset>"
  }
  try {
    const url = new URL(databaseUrl)
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`
  } catch {
    return "<unparseable DATABASE_URL>"
  }
}

let warnedMissingDatabaseUrl = false

function getPool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    if (!warnedMissingDatabaseUrl) {
      warnedMissingDatabaseUrl = true
      console.warn(
        "[statussy] DATABASE_URL is not set — the board is serving MOCK data. " +
          "Set it to the Railway Postgres DATABASE_PUBLIC_URL (see README) and redeploy."
      )
    }
    return null
  }
  globalThis.__statussyPool ??= new Pool({
    connectionString: databaseUrl,
    max: 3,
    ssl: resolveSsl(databaseUrl),
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
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
                provider_id, status::text AS status, incident_title, stale,
                fetched_at, latency_ms
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
              l.latency_ms, u.up, u.total
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
        latencyMs: row.latency_ms,
      })
    }
    return snapshots
  } catch (err) {
    console.error(
      `[statussy] live snapshot read failed (db=${describeDatabaseTarget()}) — board is falling back to MOCK data`,
      err
    )
    return new Map()
  }
}

/** Stale when the worker flagged it or the snapshot is past the threshold. */
export function isSnapshotStale(
  snapshot: Pick<LiveSnapshot, "stale" | "fetchedAt">,
  now = Date.now()
) {
  return (
    snapshot.stale || now - snapshot.fetchedAt.getTime() > STALE_AFTER_MS
  )
}

export type ProviderComponent = {
  id: number
  name: string
  status: LiveStatus
}

export type ProviderIncident = {
  id: number
  title: string
  /** Vendor lifecycle state (investigating / identified / monitoring / ...). */
  status: string
  /** Vendor severity label (minor / major / critical / maintenance / ...). */
  impact: string | null
  url: string | null
  startedAt: Date | null
  updatedAt: Date
}

export type ProviderLiveDetail = {
  /** Latest snapshot; null when the worker has not fetched this provider. */
  snapshot: Pick<
    LiveSnapshot,
    "status" | "incidentTitle" | "stale" | "fetchedAt"
  > | null
  components: ProviderComponent[]
  activeIncidents: ProviderIncident[]
}

type ComponentRow = {
  id: string
  name: string
  status: string
}

type IncidentRow = {
  id: string
  title: string
  status: string
  impact: string | null
  url: string | null
  started_at: Date | null
  updated_at: Date
}

type DetailSnapshotRow = Omit<SnapshotRow, "provider_id" | "up" | "total">

/** Vendor lifecycle states that mean an incident is over even when the feed
 *  omits `resolved_at`. */
const CLOSED_INCIDENT_STATUSES = ["resolved", "completed", "postmortem"]

/**
 * Deep-dive read for `/providers/[id]` (SMA-17): latest snapshot, current
 * components, and unresolved incidents for one provider. Returns null when no
 * database is configured or the read fails, so the page can fall back to the
 * mock registry entry — same policy as the board.
 */
export async function getProviderLiveDetail(
  providerId: string
): Promise<ProviderLiveDetail | null> {
  const pool = getPool()
  if (!pool) {
    return null
  }

  try {
    const [snapshotResult, componentsResult, incidentsResult] =
      await Promise.all([
        pool.query<DetailSnapshotRow>(
          `SELECT status::text AS status, incident_title, stale, fetched_at
           FROM provider_snapshots
           WHERE provider_id = $1
           ORDER BY fetched_at DESC, id DESC
           LIMIT 1`,
          [providerId]
        ),
        pool.query<ComponentRow>(
          `SELECT id, name, status::text AS status
           FROM components
           WHERE provider_id = $1
           ORDER BY position NULLS LAST, name, id`,
          [providerId]
        ),
        pool.query<IncidentRow>(
          `SELECT id, title, status, impact, url, started_at, updated_at
           FROM incidents
           WHERE provider_id = $1
             AND resolved_at IS NULL
             AND status != ALL($2::text[])
           ORDER BY started_at DESC NULLS LAST, id DESC`,
          [providerId, CLOSED_INCIDENT_STATUSES]
        ),
      ])

    const snapshotRow = snapshotResult.rows.at(0)
    return {
      snapshot: snapshotRow
        ? {
            status: toLiveStatus(snapshotRow.status),
            incidentTitle: snapshotRow.incident_title,
            stale: snapshotRow.stale,
            fetchedAt: snapshotRow.fetched_at,
          }
        : null,
      components: componentsResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        status: toLiveStatus(row.status),
      })),
      activeIncidents: incidentsResult.rows.map((row) => ({
        id: Number(row.id),
        title: row.title,
        status: row.status,
        impact: row.impact,
        url: row.url,
        startedAt: row.started_at,
        updatedAt: row.updated_at,
      })),
    }
  } catch (err) {
    console.error(
      `[statussy] provider detail read failed for ${providerId} (db=${describeDatabaseTarget()}) — page is falling back to MOCK data`,
      err
    )
    return null
  }
}
