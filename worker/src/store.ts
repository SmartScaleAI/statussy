import type pg from "pg"
import type { MappedComponent, MappedIncident, ServiceStatus } from "./statuspage.js"

/**
 * Normalized service state accepted by the store, regardless of which
 * fetcher produced it (Statuspage API per SMA-16/19, RSS per SMA-22).
 * `detail` is fetcher-specific structured JSON (never raw HTML).
 */
export type PersistableServiceState = {
  status: ServiceStatus
  incidentTitle: string | null
  detail: object
  components: MappedComponent[]
  incidents: MappedIncident[]
}

export type PersistOptions = {
  /**
   * Sources that only expose *active* incidents (e.g. OnlineOrNot's summary
   * API) can't tell us when an incident resolved — it just disappears from
   * the feed. When true, unresolved incidents absent from this fetch are
   * marked resolved at persist time.
   */
  resolveMissingIncidents?: boolean
}

/**
 * Vendors occasionally repeat an external id within one payload. The old
 * per-row upsert loop let the later row win; a multi-row INSERT .. ON
 * CONFLICT would instead error ("cannot affect row a second time"), so we
 * dedupe here keeping the last occurrence.
 */
function dedupeByExternalId<T extends { externalId: string }>(rows: T[]): T[] {
  if (rows.length < 2) return rows
  const byId = new Map<string, T>()
  for (const row of rows) byId.set(row.externalId, row)
  return [...byId.values()]
}

/**
 * Persist a successful fetch for one service in a single transaction:
 * a fresh snapshot row, upserted components (removing ones the vendor
 * dropped), and upserted incidents.
 *
 * SMA-99: components and incidents are written as one multi-row `unnest`
 * upsert each (a tick is a constant ~6 queries per service instead of
 * 4 + components + incidents), and `DO UPDATE` carries a `WHERE .. IS
 * DISTINCT FROM ..` guard so rows whose content didn't change are left
 * untouched — no `updated_at` rewrite, no WAL/vacuum churn.
 */
export async function persistServiceState(
  pool: pg.Pool,
  serviceId: string,
  state: PersistableServiceState,
  options: PersistOptions = {},
): Promise<void> {
  const components = dedupeByExternalId(state.components)
  const incidents = dedupeByExternalId(state.incidents)

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // SMA-31: stop writing latency_ms (column stays; new rows default to NULL).
    await client.query(
      `INSERT INTO service_snapshots (service_id, status, incident_title, detail, stale, fetched_at)
       VALUES ($1, $2, $3, $4, false, now())`,
      [
        serviceId,
        state.status,
        state.incidentTitle,
        JSON.stringify(state.detail),
      ],
    )

    if (components.length > 0) {
      await client.query(
        `INSERT INTO components (service_id, external_id, name, status, position)
         SELECT $1, c.external_id, c.name, c.status::service_status, c.position
         FROM unnest($2::text[], $3::text[], $4::text[], $5::integer[])
           AS c(external_id, name, status, position)
         ON CONFLICT (service_id, external_id) DO UPDATE
           SET name = EXCLUDED.name,
               status = EXCLUDED.status,
               position = EXCLUDED.position,
               updated_at = now()
           WHERE (components.name, components.status, components.position)
             IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.status, EXCLUDED.position)`,
        [
          serviceId,
          components.map((c) => c.externalId),
          components.map((c) => c.name),
          components.map((c) => c.status),
          components.map((c) => c.position),
        ],
      )
    }
    // Components the vendor no longer reports are gone, not "last-known".
    await client.query(
      `DELETE FROM components
       WHERE service_id = $1 AND external_id != ALL($2::text[])`,
      [serviceId, components.map((c) => c.externalId)],
    )

    if (incidents.length > 0) {
      await client.query(
        `INSERT INTO incidents (service_id, external_id, title, status, impact, url, started_at, resolved_at)
         SELECT $1, i.external_id, i.title, i.status, i.impact, i.url, i.started_at, i.resolved_at
         FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::timestamptz[], $8::timestamptz[])
           AS i(external_id, title, status, impact, url, started_at, resolved_at)
         ON CONFLICT (service_id, external_id) DO UPDATE
           SET title = EXCLUDED.title,
               status = EXCLUDED.status,
               impact = EXCLUDED.impact,
               url = EXCLUDED.url,
               started_at = EXCLUDED.started_at,
               resolved_at = EXCLUDED.resolved_at,
               updated_at = now()
           WHERE (incidents.title, incidents.status, incidents.impact, incidents.url,
                  incidents.started_at, incidents.resolved_at)
             IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.status, EXCLUDED.impact, EXCLUDED.url,
                  EXCLUDED.started_at, EXCLUDED.resolved_at)`,
        [
          serviceId,
          incidents.map((i) => i.externalId),
          incidents.map((i) => i.title),
          incidents.map((i) => i.status),
          incidents.map((i) => i.impact),
          incidents.map((i) => i.url),
          incidents.map((i) => i.startedAt),
          incidents.map((i) => i.resolvedAt),
        ],
      )
    }

    if (options.resolveMissingIncidents) {
      await client.query(
        `UPDATE incidents
         SET status = 'resolved',
             resolved_at = COALESCE(resolved_at, now()),
             updated_at = now()
         WHERE service_id = $1
           AND resolved_at IS NULL
           AND external_id != ALL($2::text[])`,
        [serviceId, incidents.map((i) => i.externalId)],
      )
    }

    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/**
 * SMA-98: snapshot retention window. 30 days is INTENTIONAL — Colin wants a
 * full 30-day history for upcoming history metrics/visuals. Do not shorten
 * without a product decision.
 */
export const SNAPSHOT_RETENTION_DAYS = 30

/**
 * Delete snapshots older than the retention window to bound DB growth
 * (~450 inserts/tick with no retention, per SMA-95). Runs once per worker
 * tick. Each service's latest snapshot is always kept, even if it has aged
 * past the window (e.g. a retired fetcher), so the board's
 * latest-snapshot-per-service query never loses a row it displays.
 * Returns the number of rows deleted.
 */
export async function pruneOldSnapshots(pool: pg.Pool): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM service_snapshots
     WHERE fetched_at < now() - make_interval(days => $1)
       AND id NOT IN (
         SELECT DISTINCT ON (service_id) id
         FROM service_snapshots
         ORDER BY service_id, fetched_at DESC, id DESC
       )`,
    [SNAPSHOT_RETENTION_DAYS],
  )
  return rowCount ?? 0
}

/**
 * On fetch failure: keep all last-known rows untouched and flag the
 * service's latest snapshot as stale. If the service has no snapshot
 * yet, record an 'unknown' stale snapshot so the board shows something.
 */
export async function markServiceStale(pool: pg.Pool, serviceId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE service_snapshots SET stale = true
     WHERE id = (
       SELECT id FROM service_snapshots
       WHERE service_id = $1
       ORDER BY fetched_at DESC, id DESC
       LIMIT 1
     )`,
    [serviceId],
  )
  if (rowCount === 0) {
    await pool.query(
      `INSERT INTO service_snapshots (service_id, status, stale) VALUES ($1, 'unknown', true)`,
      [serviceId],
    )
  }
}
