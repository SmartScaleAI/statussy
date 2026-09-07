import type { Service, ServiceStatus } from "@/data/services"
import type { ChickletDisplay } from "@/lib/health"

export type { Service, ServiceCategory, ServiceStatus } from "@/data/services"
export type { ChickletDisplay } from "@/lib/health"

/**
 * Card status: mock statuses plus 'unknown' from the live worker schema.
 * Defined here (not imported from `lib/live-status`) so this module stays
 * client-safe for SMA-37 favorites.
 */
export type BoardStatus = ServiceStatus | "unknown"

/** One board card: mock config merged with the latest live snapshot. */
export type BoardService = Omit<Service, "status"> & {
  status: BoardStatus
  /** True when status comes from a Postgres snapshot (vs. mock fallback). */
  live: boolean
  /** Worker flagged the snapshot stale, or it is older than the threshold. */
  stale: boolean
  /**
   * Health chicklet (SMA-31/SMA-79): "Health X%" from current component rows,
   * "N open" when the service has no component grid but open incidents, or
   * "No incidents" when quiet with no grid. Never faked from overall status.
   * `healthPct` is only set in the component-health mode (drives Health %
   * sort); the incident modes fall back to status-based ordering.
   */
  chicklet: ChickletDisplay
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

export function summarizeServices(items: { status: BoardStatus }[]) {
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

/** Compact card footer stamp with a UTC suffix (SMA-36). */
export function formatCardUpdatedAt(iso: string) {
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso))} UTC`
}
