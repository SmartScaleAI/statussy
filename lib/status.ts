import { connection } from "next/server"

import { LAST_REFRESHED_AT, services, type Service } from "@/data/services"
import { formatHealth } from "@/lib/health"
import {
  getLiveSnapshots,
  isSnapshotStale,
  type LiveStatus,
} from "@/lib/live-status"

export type { Service, ServiceCategory, ServiceStatus } from "@/data/services"

/** Card status: mock statuses plus 'unknown' from the live worker schema. */
export type BoardStatus = LiveStatus

/** One board card: mock config merged with the latest live snapshot. */
export type BoardService = Omit<Service, "status"> & {
  status: BoardStatus
  /** True when status comes from a Postgres snapshot (vs. mock fallback). */
  live: boolean
  /** Worker flagged the snapshot stale, or it is older than the threshold. */
  stale: boolean
  /**
   * Live Health chicklet (SMA-31): operational components ÷ total current
   * components, formatted as a percent. Null until a live snapshot exists
   * (mock fallback shows an em-dash). This is a live snapshot, not
   * historical uptime or a vendor SLA.
   */
  healthLabel: string | null
}

/** Lower number = more urgent. Non-operational statuses sort above healthy. */
const STATUS_RANK: Record<BoardStatus, number> = {
  major_outage: 0,
  partial_outage: 1,
  degraded: 2,
  maintenance: 3,
  unknown: 4,
  operational: 5,
}

export const STATUS_LABEL: Record<BoardStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
  unknown: "Unknown",
}

/** Short card-header labels (dot + text). */
export const STATUS_SHORT: Record<BoardStatus, string> = {
  operational: "Live",
  degraded: "Degraded",
  partial_outage: "Partial Outage",
  major_outage: "Major Outage",
  maintenance: "Maintenance",
  unknown: "Unknown",
}

export function isOperational(status: BoardStatus) {
  return status === "operational"
}

export function sortServices(items: BoardService[]) {
  return [...items].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    if (rank !== 0) {
      return rank
    }
    return a.name.localeCompare(b.name)
  })
}

export function summarizeServices(items: BoardService[]) {
  const operational = items.filter((item) => isOperational(item.status)).length
  return {
    total: items.length,
    operational,
    issues: items.length - operational,
  }
}

export function formatTimestamp(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso))
}

/** Compact card footer stamp — no “Updated” / timezone suffix. */
export function formatCardUpdatedAt(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso))
}

/**
 * Board payload: latest Postgres snapshot per provider (SMA-15/16 worker)
 * merged over the mock registry. Providers without a snapshot keep their
 * prior mock entry — see the fallback policy in `lib/live-status.ts`.
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
