/**
 * Railway status fetcher + mapper (Cloud Wave A).
 *
 * Railway hosts its own status page (not Statuspage). The documented JSON
 * is `https://api.railwaystatus.com/status` with schema at
 * `https://api.railwaystatus.com/status/schema.json`. Railway publishes
 * that endpoint as-is; the shape may change without notice.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const RAILWAY_STATUS_URL = "https://api.railwaystatus.com/status"
export const RAILWAY_STATUS_PAGE = "https://status.railway.com"

export type RailwayComponent = {
  id?: string
  name?: string
  status?: string
  position?: number
  type?: string
  components?: RailwayComponent[] | null
}

export type RailwayIncident = {
  id?: string
  slug?: string
  title?: string
  status?: string
  worstImpact?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  resolvedAt?: string | null
}

export type RailwayMaintenance = {
  id?: string
  slug?: string
  title?: string
  status?: string
  scheduledStart?: string | null
  estimatedEnd?: string | null
}

export type RailwayStatus = {
  components?: RailwayComponent[] | null
  incidents?: RailwayIncident[] | null
  maintenances?: RailwayMaintenance[] | null
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

const CLOSED_INCIDENT_STATUSES = new Set([
  "resolved",
  "completed",
  "postmortem",
])

const ACTIVE_MAINTENANCE_STATUSES = new Set([
  "in_progress",
  "started",
  "underway",
  "verifying",
])

/** Railway component / incident impact -> our service_status enum. */
export function mapRailwayStatus(status: string | undefined | null): ServiceStatus {
  switch ((status ?? "").toLowerCase()) {
    case "operational":
    case "none":
      return "operational"
    case "degraded":
    case "degraded_performance":
    case "minor":
      return "degraded"
    case "partial_outage":
    case "major":
      return "partial_outage"
    case "major_outage":
    case "outage":
    case "down":
    case "critical":
      return "major_outage"
    case "maintenance":
    case "under_maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

export function flattenRailwayComponents(
  entries: RailwayComponent[] | null | undefined,
): RailwayComponent[] {
  const out: RailwayComponent[] = []
  for (const entry of entries ?? []) {
    if (entry.type === "group") {
      out.push(...flattenRailwayComponents(entry.components))
      continue
    }
    if (entry.id && entry.name) {
      out.push(entry)
    }
  }
  return out
}

function isOpenIncident(incident: RailwayIncident): boolean {
  if (incident.resolvedAt) return false
  return !CLOSED_INCIDENT_STATUSES.has((incident.status ?? "").toLowerCase())
}

function isActiveMaintenance(maintenance: RailwayMaintenance): boolean {
  return ACTIVE_MAINTENANCE_STATUSES.has((maintenance.status ?? "").toLowerCase())
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function incidentUrl(incident: RailwayIncident): string {
  if (incident.slug) {
    return `${RAILWAY_STATUS_PAGE}/incident/${incident.slug}`
  }
  return RAILWAY_STATUS_PAGE
}

export type MapRailwayOptions = {
  maxIncidents?: number
}

/**
 * Map Railway's public status JSON into our normalized service state.
 * Overall status is the worst leaf-component status, then open incidents,
 * then in-progress maintenances. Scheduled-but-not-started windows do not
 * paint the card.
 */
export function mapRailway(
  payload: RailwayStatus,
  options: MapRailwayOptions = {},
): MappedServiceState {
  const leaves = flattenRailwayComponents(payload.components)
  const components: MappedComponent[] = leaves.map((component, index) => ({
    externalId: component.id as string,
    name: component.name as string,
    status: mapRailwayStatus(component.status),
    position: typeof component.position === "number" ? component.position : index,
  }))

  const incidents = [...(payload.incidents ?? [])]
    .filter((incident) => incident.id && incident.title)
    .slice(0, options.maxIncidents ?? 25)

  const mappedIncidents: MappedIncident[] = incidents.map((incident) => {
    const open = isOpenIncident(incident)
    return {
      externalId: incident.id as string,
      title: incident.title as string,
      status: (incident.status ?? (open ? "investigating" : "resolved")).toLowerCase(),
      impact: incident.worstImpact ? incident.worstImpact.toLowerCase() : null,
      url: incidentUrl(incident),
      startedAt: toIso(incident.createdAt),
      resolvedAt: open ? null : toIso(incident.resolvedAt),
    }
  })

  let status: ServiceStatus = "operational"
  for (const component of components) {
    const mapped = component.status === "unknown" ? "operational" : component.status
    status = worst(status, mapped)
  }
  for (const incident of incidents.filter(isOpenIncident)) {
    const mapped = mapRailwayStatus(incident.worstImpact ?? incident.status)
    status = worst(status, mapped === "unknown" ? "degraded" : mapped)
  }

  const activeMaintenances = (payload.maintenances ?? []).filter(isActiveMaintenance)
  if (activeMaintenances.length > 0) {
    status = worst(status, "maintenance")
  }

  const openIncidentTitle = mappedIncidents.find(
    (incident) => !CLOSED_INCIDENT_STATUSES.has(incident.status),
  )?.title
  const maintenanceTitle = activeMaintenances[0]?.title ?? null

  return {
    status,
    incidentTitle: openIncidentTitle ?? maintenanceTitle,
    detail: {
      source: "railway",
      openIncidentCount: incidents.filter(isOpenIncident).length,
      activeMaintenanceCount: activeMaintenances.length,
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
 * Fetch and map live Railway state.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchRailwayState(options: FetchOptions): Promise<MappedServiceState> {
  const payload = await fetchJson<RailwayStatus>(RAILWAY_STATUS_URL, options)
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.components)) {
    throw new Error(`Unexpected Railway status payload from ${RAILWAY_STATUS_URL}`)
  }
  return mapRailway(payload, { maxIncidents: options.maxIncidents })
}
