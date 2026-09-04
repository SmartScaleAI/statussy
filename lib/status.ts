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

/** Short card-header labels (dot + text). */
export const STATUS_SHORT: Record<Service["status"], string> = {
  operational: "Live",
  degraded: "Degraded",
  partial_outage: "Partial Outage",
  major_outage: "Major Outage",
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

/** Mock 30-day window (one tick per day) until live Statuspage history exists. */
export const STATUS_HISTORY_DAYS = 30

function seedFromId(id: string) {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0xffffffff
  }
}

/**
 * Deterministic mock day-by-day history. Recent ticks match `service.status`.
 * Replace with Statuspage incident windows when live feeds land.
 */
export function getStatusHistory(service: Service): Service["status"][] {
  const next = rng(seedFromId(service.id))
  const ticks: Service["status"][] = []

  for (let i = 0; i < STATUS_HISTORY_DAYS; i++) {
    const roll = next()
    if (roll < 0.012) {
      ticks.push("degraded")
    } else if (roll < 0.016) {
      ticks.push("partial_outage")
    } else {
      ticks.push("operational")
    }
  }

  const recent =
    service.status === "operational"
      ? 0
      : service.status === "degraded"
        ? 4 + Math.floor(next() * 4)
        : service.status === "maintenance"
          ? 2 + Math.floor(next() * 3)
          : service.status === "partial_outage"
            ? 3 + Math.floor(next() * 4)
            : 2 + Math.floor(next() * 3)

  for (let i = STATUS_HISTORY_DAYS - recent; i < STATUS_HISTORY_DAYS; i++) {
    ticks[i] = service.status
  }

  return ticks
}

/** Uptime over the mock history window — not a measured SLA. */
export function formatHistoryUptime(ticks: Service["status"][]) {
  const up = ticks.filter((tick) => tick === "operational").length
  const pct = (up / ticks.length) * 100
  const digits = pct >= 99.5 ? 2 : 1
  return `${pct.toFixed(digits)}% uptime`
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
