import { cache } from "react"

import { LAST_REFRESHED_AT, services, type Service } from "@/data/services"
import { describeChicklet, type ChickletDisplay } from "@/lib/health"
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
/** Append the service's scope note (e.g. Sysdig US-East-1) to the tooltip. */
function withScopeNote(
  display: ChickletDisplay,
  service: Pick<Service, "scopeNote">
): ChickletDisplay {
  if (!service.scopeNote) {
    return display
  }
  return { ...display, title: `${display.title} ${service.scopeNote}` }
}

export const getStatusBoard = cache(async function getStatusBoard() {
  // No `connection()` gate here (SMA-97): the board route is ISR-cached with
  // `revalidate = 60` (see `app/page.tsx`), so this render — including the
  // Postgres read — runs at most ~once a minute instead of on every hit.
  // A build-time prerender is fine now: it can be at most 60s older than an
  // uncached render, well inside the 5m worker cadence. The freshness stamp
  // stays DB-driven (`refreshedAt` below), so the Stale badge semantics are
  // unchanged.
  const snapshots = await getLiveSnapshots()

  const items = sortServices(
    services.map((service): BoardService => {
      const snapshot = snapshots.get(service.id)
      if (!snapshot) {
        return {
          ...service,
          live: false,
          stale: false,
          // Mock fallback: no live snapshot yet, so no honest chicklet value.
          chicklet: withScopeNote(
            {
              label: "Health",
              value: "—",
              title: "No live data for this service yet.",
              healthPct: null,
            },
            service
          ),
        }
      }
      return {
        ...service,
        status: snapshot.status,
        incidentTitle: snapshot.incidentTitle ?? undefined,
        updatedAt: snapshot.fetchedAt.toISOString(),
        live: true,
        stale: isSnapshotStale(snapshot),
        chicklet: withScopeNote(describeChicklet(snapshot.chicklet), service),
      }
    })
  )

  const liveCount = items.filter((item) => item.live).length
  // Board freshness (SMA-83): the newest successful snapshot fetch across
  // live services — "when did the worker last land board data?". Not page
  // render time (which would never age) and not a worker tick that failed to
  // write. It keeps aging when the worker/poller dies, which is exactly what
  // the board-stale signal watches. Mock fallback uses the static mock stamp,
  // so a board with no live data reads as stale — honest, since it isn't
  // fresh. One healthy vendor fetch is enough to count as a board update;
  // individual failing vendors stay flagged by their per-card Stale state.
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
})
