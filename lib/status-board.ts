import { connection } from "next/server"

import { LAST_REFRESHED_AT, services } from "@/data/services"
import { formatHealth } from "@/lib/health"
import { getLiveSnapshots, isSnapshotStale } from "@/lib/live-status"
import {
  sortServices,
  summarizeServices,
  type BoardService,
} from "@/lib/status"

/**
 * Board payload: latest Postgres snapshot per service (SMA-15/16 worker)
 * merged over the mock registry. Services without a snapshot keep their
 * prior mock entry — see the fallback policy in `lib/live-status.ts`.
 *
 * Kept out of `lib/status.ts` so card helpers stay client-safe (SMA-37).
 */
export async function getStatusBoard() {
  // Status must reflect the DB at request time, never a build-time prerender.
  await connection()
  const snapshots = await getLiveSnapshots()

  const items = sortServices(
    services.map((service): BoardService => {
      const snapshot = snapshots.get(service.id)
      if (!snapshot) {
        return {
          ...service,
          live: false,
          stale: false,
          healthLabel: null,
        }
      }
      return {
        ...service,
        status: snapshot.status,
        incidentTitle: snapshot.incidentTitle ?? undefined,
        updatedAt: snapshot.fetchedAt.toISOString(),
        live: true,
        stale: isSnapshotStale(snapshot),
        healthLabel: formatHealth(
          snapshot.health.operational,
          snapshot.health.total
        ),
      }
    })
  )

  const liveCount = items.filter((item) => item.live).length
  const refreshedAt = items
    .filter((item) => item.live)
    .map((item) => item.updatedAt)
    .sort()
    .at(-1)

  return {
    items,
    summary: summarizeServices(items),
    refreshedAt: refreshedAt ?? LAST_REFRESHED_AT,
    source: liveCount > 0 ? ("live" as const) : ("mock" as const),
  }
}
