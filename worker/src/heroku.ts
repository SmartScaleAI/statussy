/**
 * Heroku status fetcher + mapper (Cloud Wave B).
 *
 * Salesforce Trust is now the primary incident channel
 * (`https://status.salesforce.com/products/Heroku`). The legacy v4 JSON at
 * `https://status.heroku.com/api/v4/current-status` is still the easy public
 * feed and is what this fetcher reads. Heroku has said v4 will be deprecated;
 * follow up with a Trust API mapper when that happens.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const HEROKU_STATUS_API = "https://status.heroku.com/api/v4/current-status"
export const HEROKU_STATUS_PAGE = "https://status.salesforce.com/products/Heroku"

export type HerokuSystem = {
  system?: string
  status?: string
}

export type HerokuIncident = {
  id?: number | string
  title?: string
  created_at?: string | null
  updated_at?: string | null
  resolved_at?: string | null
  resolved?: boolean
  full_url?: string | null
  href?: string | null
  systems?: { name?: string; status?: string }[] | null
}

export type HerokuCurrentStatus = {
  status?: HerokuSystem[] | null
  incidents?: HerokuIncident[] | null
  scheduled?: HerokuIncident[] | null
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

/** Heroku system color / incident flag -> our service_status enum. */
export function mapHerokuColor(status: string | undefined | null): ServiceStatus {
  switch ((status ?? "").toLowerCase()) {
    case "green":
      return "operational"
    case "yellow":
      return "degraded"
    case "orange":
      return "partial_outage"
    case "red":
      return "major_outage"
    case "blue":
      return "maintenance"
    default:
      return "unknown"
  }
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isOpenIncident(incident: HerokuIncident): boolean {
  if (incident.resolved === true || incident.resolved_at) return false
  return true
}

export type MapHerokuOptions = {
  maxIncidents?: number
}

/**
 * Map Heroku Status API v4 current-status into our normalized shape.
 * Overall status is the worst system color. Open incidents supply the
 * headline. Upcoming scheduled windows do not paint the card.
 */
export function mapHeroku(
  payload: HerokuCurrentStatus,
  options: MapHerokuOptions = {},
): MappedServiceState {
  const systems = payload.status ?? []
  const components: MappedComponent[] = systems
    .filter((system) => system.system)
    .map((system, index) => ({
      externalId: system.system as string,
      name: system.system as string,
      status: mapHerokuColor(system.status),
      position: index,
    }))

  let status: ServiceStatus = "operational"
  for (const component of components) {
    const mapped = component.status === "unknown" ? "operational" : component.status
    status = worst(status, mapped)
  }

  const incidents = [...(payload.incidents ?? [])]
    .filter((incident) => incident.id != null && incident.title)
    .slice(0, options.maxIncidents ?? 25)

  const mappedIncidents: MappedIncident[] = incidents.map((incident) => {
    const open = isOpenIncident(incident)
    return {
      externalId: String(incident.id),
      title: incident.title as string,
      status: open ? "investigating" : "resolved",
      impact: null,
      url: incident.full_url ?? incident.href ?? HEROKU_STATUS_PAGE,
      startedAt: toIso(incident.created_at),
      resolvedAt: open ? null : toIso(incident.resolved_at),
    }
  })

  const openIncident = mappedIncidents.find((incident) => incident.status !== "resolved")

  return {
    status,
    incidentTitle: openIncident?.title ?? null,
    detail: {
      source: "heroku",
      systems: systems.map((system) => ({
        system: system.system ?? null,
        status: system.status ?? null,
      })),
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
 * Fetch and map live Heroku state from Status API v4.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchHerokuState(options: FetchOptions): Promise<MappedServiceState> {
  const payload = await fetchJson<HerokuCurrentStatus>(HEROKU_STATUS_API, options)
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.status)) {
    throw new Error(`Unexpected Heroku status payload from ${HEROKU_STATUS_API}`)
  }
  return mapHeroku(payload, { maxIncidents: options.maxIncidents })
}
