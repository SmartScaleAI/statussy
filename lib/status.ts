import { LAST_REFRESHED_AT, services, type Service } from "@/data/services"

export type { Service, ServiceCategory, ServiceStatus } from "@/data/services"

/** Lower number = more urgent. Non-operational statuses sort above healthy. */
const STATUS_RANK = {
  major_outage: 0,
  partial_outage: 1,
  degraded: 2,
  maintenance: 3,
  operational: 4,
} as const

export const STATUS_LABEL: Record<Service["status"], string> = {
  operational: "Operational",
  degraded: "Degraded",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
}

export function isOperational(status: Service["status"]) {
  return status === "operational"
}

export function sortServices(items: Service[]) {
  return [...items].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    if (rank !== 0) {
      return rank
    }
    return a.name.localeCompare(b.name)
  })
}

export function summarizeServices(items: Service[]) {
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

/**
 * v0 board payload. Swap `services` / `LAST_REFRESHED_AT` for a Statuspage or
 * RSS mapper that still returns `Service[]` — no UI changes required.
 */
export function getStatusBoard() {
  const items = sortServices(services)
  return {
    items,
    summary: summarizeServices(items),
    refreshedAt: LAST_REFRESHED_AT,
    source: "mock" as const,
  }
}
