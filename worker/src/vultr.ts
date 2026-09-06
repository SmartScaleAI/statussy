/**
 * Vultr status fetcher + mapper (Cloud Wave C).
 *
 * Official JSON is `https://status.vultr.com/status.json` (regions plus
 * service-wide alerts). There is no page-level indicator: overall status is
 * the worst current region / service alert. Future scheduled-maintenance
 * windows do not paint the card (same rule as Railway / Heroku).
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const VULTR_STATUS_URL = "https://status.vultr.com/status.json"
export const VULTR_STATUS_PAGE = "https://status.vultr.com"

export type VultrAlertEntry = {
  updated_at?: string
  message?: string
}

export type VultrAlert = {
  id?: string
  subject?: string
  status?: string
  start_date?: string
  updated_at?: string
  entries?: VultrAlertEntry[] | null
}

export type VultrRegion = {
  location?: string
  country?: string
  country_name?: string
  alerts?: VultrAlert[] | null
}

export type VultrStatus = {
  service_alerts?: VultrAlert[] | null
  regions?: Record<string, VultrRegion> | null
}

const SEVERITY_RANK: Record<ServiceStatus, number> = {
  operational: 0,
  unknown: 1,
  maintenance: 2,
  degraded: 3,
  partial_outage: 4,
  major_outage: 5,
}

function worst(a: ServiceStatus, b: ServiceStatus): ServiceStatus {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a
}

const CLOSED_ALERT_STATUSES = new Set(["resolved", "completed", "closed"])

const WINDOW_START_RE = /Start Time:\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*UTC/i
const WINDOW_END_RE = /End Time:\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*UTC/i

export type MapVultrOptions = {
  maxIncidents?: number
  now?: Date
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function parseUtcStamp(stamp: string): Date | null {
  const date = new Date(`${stamp.replace(" ", "T")}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function alertMessage(alert: VultrAlert): string {
  return (alert.entries ?? []).map((entry) => entry.message ?? "").join("\n")
}

export function parseVultrWindow(alert: VultrAlert): {
  start: Date | null
  end: Date | null
} {
  const message = alertMessage(alert)
  const startMatch = message.match(WINDOW_START_RE)
  const endMatch = message.match(WINDOW_END_RE)
  return {
    start: startMatch ? parseUtcStamp(startMatch[1]) : null,
    end: endMatch ? parseUtcStamp(endMatch[1]) : null,
  }
}

export function isVultrScheduledMaintenance(alert: VultrAlert): boolean {
  const subject = alert.subject ?? ""
  const message = alertMessage(alert)
  return /scheduled maintenance/i.test(subject) || /Event Type:\s*.*Upgrade/i.test(message)
}

function isClosedAlert(alert: VultrAlert): boolean {
  return CLOSED_ALERT_STATUSES.has((alert.status ?? "").toLowerCase())
}

/**
 * Future announced windows stay off the rollup. An in-progress window
 * (now between Start Time and End Time) is live maintenance.
 */
export function vultrAlertRollup(
  alert: VultrAlert,
  now: Date,
): ServiceStatus {
  if (isClosedAlert(alert)) return "operational"
  if (isVultrScheduledMaintenance(alert)) {
    const { start, end } = parseVultrWindow(alert)
    if (start && now < start) return "operational"
    if (end && now > end) return "operational"
    if (start && now >= start) return "maintenance"
    return "operational"
  }

  const subject = `${alert.subject ?? ""} ${alertMessage(alert)}`.toLowerCase()
  if (/\b(outage|unavailable|down|offline)\b/.test(subject)) {
    return "major_outage"
  }
  if (/\b(partial|degraded|latency|elevated)\b/.test(subject)) {
    return "degraded"
  }
  return (alert.status ?? "").toLowerCase() === "ongoing" ? "degraded" : "unknown"
}

function alertIncidentStatus(alert: VultrAlert, rollup: ServiceStatus): string {
  if (isClosedAlert(alert)) return "resolved"
  if (rollup === "maintenance") return "in_progress"
  if (isVultrScheduledMaintenance(alert)) return "scheduled"
  return (alert.status ?? "investigating").toLowerCase()
}

function collectAlerts(payload: VultrStatus): VultrAlert[] {
  const byId = new Map<string, VultrAlert>()
  const add = (alert: VultrAlert | undefined) => {
    if (!alert?.id || !alert.subject) return
    if (!byId.has(alert.id)) byId.set(alert.id, alert)
  }
  for (const alert of payload.service_alerts ?? []) add(alert)
  for (const region of Object.values(payload.regions ?? {})) {
    for (const alert of region.alerts ?? []) add(alert)
  }
  return [...byId.values()]
}

/**
 * Map Vultr's public status.json into our normalized service state.
 */
export function mapVultr(
  payload: VultrStatus,
  options: MapVultrOptions = {},
): MappedServiceState {
  const now = options.now ?? new Date()
  const regionEntries = Object.entries(payload.regions ?? {})
  const components: MappedComponent[] = regionEntries.map(([id, region], index) => {
    let status: ServiceStatus = "operational"
    for (const alert of region.alerts ?? []) {
      const mapped = vultrAlertRollup(alert, now)
      status = worst(status, mapped === "unknown" ? "operational" : mapped)
    }
    return {
      externalId: id,
      name: region.location ? `${region.location} (${id})` : id,
      status,
      position: index,
    }
  })

  let status: ServiceStatus = "operational"
  for (const component of components) {
    status = worst(status, component.status)
  }
  for (const alert of payload.service_alerts ?? []) {
    const mapped = vultrAlertRollup(alert, now)
    status = worst(status, mapped === "unknown" ? "operational" : mapped)
  }

  const alerts = collectAlerts(payload).slice(0, options.maxIncidents ?? 25)
  const mappedIncidents: MappedIncident[] = alerts.map((alert) => {
    const rollup = vultrAlertRollup(alert, now)
    const { start } = parseVultrWindow(alert)
    const closed = isClosedAlert(alert)
    return {
      externalId: alert.id as string,
      title: alert.subject as string,
      status: alertIncidentStatus(alert, rollup),
      impact: rollup === "operational" ? null : rollup,
      url: VULTR_STATUS_PAGE,
      startedAt: toIso(start?.toISOString() ?? alert.start_date),
      resolvedAt: closed ? toIso(alert.updated_at) : null,
    }
  })

  const headline = mappedIncidents
    .filter((incident) => incident.status !== "resolved" && incident.status !== "scheduled")
    .reduce<(typeof mappedIncidents)[number] | null>((worstIncident, incident) => {
      if (!worstIncident) return incident
      const impact = (incident.impact ?? "operational") as ServiceStatus
      const current = (worstIncident.impact ?? "operational") as ServiceStatus
      return SEVERITY_RANK[impact] > SEVERITY_RANK[current] ? incident : worstIncident
    }, null)

  return {
    status,
    incidentTitle: headline?.title ?? null,
    detail: {
      source: "vultr",
      regionCount: components.length,
      openAlertCount: mappedIncidents.filter(
        (incident) => incident.status !== "resolved" && incident.status !== "scheduled",
      ).length,
    },
    components,
    incidents: mappedIncidents,
  }
}

async function fetchJson<T>(url: string, options: FetchOptions): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

/**
 * Fetch and map live Vultr state.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchVultrState(options: FetchOptions): Promise<MappedServiceState> {
  const payload = await fetchJson<VultrStatus>(VULTR_STATUS_URL, options)
  if (!payload || typeof payload !== "object" || !payload.regions || typeof payload.regions !== "object") {
    throw new Error(`Unexpected Vultr status payload from ${VULTR_STATUS_URL}`)
  }
  return mapVultr(payload, { maxIncidents: options.maxIncidents })
}
