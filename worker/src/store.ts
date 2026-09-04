import type pg from "pg"
import type { MappedProviderState } from "./statuspage.js"

/**
 * Persist a successful fetch for one provider in a single transaction:
 * a fresh snapshot row, upserted components (removing ones the vendor
 * dropped), and upserted incidents.
 */
export async function persistProviderState(
  pool: pg.Pool,
  providerId: string,
  state: MappedProviderState,
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(
      `INSERT INTO provider_snapshots (provider_id, status, incident_title, detail, stale, fetched_at)
       VALUES ($1, $2, $3, $4, false, now())`,
      [providerId, state.status, state.incidentTitle, JSON.stringify(state.detail)],
    )

    for (const component of state.components) {
      await client.query(
        `INSERT INTO components (provider_id, external_id, name, status, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (provider_id, external_id) DO UPDATE
           SET name = EXCLUDED.name,
               status = EXCLUDED.status,
               position = EXCLUDED.position,
               updated_at = now()`,
        [providerId, component.externalId, component.name, component.status, component.position],
      )
    }
    // Components the vendor no longer reports are gone, not "last-known".
    await client.query(
      `DELETE FROM components
       WHERE provider_id = $1 AND external_id != ALL($2::text[])`,
      [providerId, state.components.map((c) => c.externalId)],
    )

    for (const incident of state.incidents) {
      await client.query(
        `INSERT INTO incidents (provider_id, external_id, title, status, impact, url, started_at, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (provider_id, external_id) DO UPDATE
           SET title = EXCLUDED.title,
               status = EXCLUDED.status,
               impact = EXCLUDED.impact,
               url = EXCLUDED.url,
               started_at = EXCLUDED.started_at,
               resolved_at = EXCLUDED.resolved_at,
               updated_at = now()`,
        [
          providerId,
          incident.externalId,
          incident.title,
          incident.status,
          incident.impact,
          incident.url,
          incident.startedAt,
          incident.resolvedAt,
        ],
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
 * On fetch failure: keep all last-known rows untouched and flag the
 * provider's latest snapshot as stale. If the provider has no snapshot
 * yet, record an 'unknown' stale snapshot so the board shows something.
 */
export async function markProviderStale(pool: pg.Pool, providerId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE provider_snapshots SET stale = true
     WHERE id = (
       SELECT id FROM provider_snapshots
       WHERE provider_id = $1
       ORDER BY fetched_at DESC, id DESC
       LIMIT 1
     )`,
    [providerId],
  )
  if (rowCount === 0) {
    await pool.query(
      `INSERT INTO provider_snapshots (provider_id, status, stale) VALUES ($1, 'unknown', true)`,
      [providerId],
    )
  }
}
