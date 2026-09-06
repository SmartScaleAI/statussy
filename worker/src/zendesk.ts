/**
 * Zendesk status fetcher + mapper (Support Wave A).
 *
 * status.zendesk.com is a custom SSP (not Statuspage). The public JSON is
 * `/api/ssp/services.json` (top-level products) and
 * `/api/ssp/incidents.json?as_of_date=YYYY-MM-DD&days_back=N`. Upcoming
 * maintenance does not paint the card.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const ZENDESK_STATUS_PAGE = "https://status.zendesk.com"
export const ZENDESK_SERVICES_API = `${ZENDESK_STATUS_PAGE}/api/ssp/services.json`

export type ZendeskResource<T> = {
  id?: string
  type?: string
  attributes?: T
}

export type ZendeskServiceAttrs = {
  name?: string
  slug?: string
  position?: number
  deprecated?: boolean
}

export type ZendeskIncidentAttrs = {
  name?: string
  impact?: string | null
  status?: string | null
  outage?: boolean
  degradation?: boolean
  startedAt?: string | null
  resolvedAt?: string | null
  internalToolsOnly?: boolean
}

export type ZendeskIncidentServiceAttrs = {
  incidentId?: number
  serviceId?: number
  serviceName?: string
  serviceParentId?: number | null
  outage?: boolean
  degradation?: boolean
  resolvedAt?: string | null
}

export type ZendeskList<T> = {
  data?: ZendeskResource<T>[] | null
  included?: ZendeskResource<ZendeskIncidentServiceAttrs>[] | null
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

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Zendesk incident impact / outage flags -> our service_status enum. */
export function mapZendeskImpact(
  impact: string | null | undefined,
  flags: { outage?: boolean; degradation?: boolean } = {},
): ServiceStatus {
  switch ((impact ?? "").toLowerCase()) {
    case "critical":
      return "major_outage"
    case "major":
      return "partial_outage"
    case "minor":
      return "degraded"
    case "maintenance":
      return "maintenance"
    case "none":
      return "operational"
    default:
      if (flags.outage) return "major_outage"
      if (flags.degradation) return "degraded"
      return "unknown"
  }
}

function isOpenIncident(attrs: ZendeskIncidentAttrs): boolean {
  const status = (attrs.status ?? "").toLowerCase()
  if (status === "resolved" || status === "completed") return false
  if (attrs.resolvedAt) return false
  return true
}

export type MapZendeskOptions = {
  maxIncidents?: number
}

/**
 * Map Zendesk SSP services + incidents into our normalized shape.
 * Overall status is the worst open incident. Top-level services become
 * components; open incidentServices paint the matching product.
 */
export function mapZendesk(
  services: ZendeskList<ZendeskServiceAttrs>,
  incidents: ZendeskList<ZendeskIncidentAttrs>,
  options: MapZendeskOptions = {},
): MappedServiceState {
  const components: MappedComponent[] = (services.data ?? [])
    .filter((service) => service.id && service.attributes?.name && !service.attributes.deprecated)
    .map((service) => ({
      externalId: service.id as string,
      name: service.attributes?.name as string,
      status: "operational" as ServiceStatus,
      position:
        typeof service.attributes?.position === "number"
          ? service.attributes.position
          : null,
    }))

  const componentById = new Map(components.map((component) => [component.externalId, component]))

  const rows = [...(incidents.data ?? [])]
    .filter(
      (incident) =>
        incident.id &&
        incident.attributes?.name &&
        incident.attributes.internalToolsOnly !== true,
    )
    .slice(0, options.maxIncidents ?? 25)

  const mappedIncidents: MappedIncident[] = rows.map((incident) => {
    const attrs = incident.attributes as ZendeskIncidentAttrs
    const open = isOpenIncident(attrs)
    return {
      externalId: incident.id as string,
      title: attrs.name as string,
      status: open ? (attrs.status ?? "investigating") : "resolved",
      impact: attrs.impact ?? null,
      url: ZENDESK_STATUS_PAGE,
      startedAt: toIso(attrs.startedAt),
      resolvedAt: open ? null : toIso(attrs.resolvedAt),
    }
  })

  let status: ServiceStatus = "operational"
  const openRows = rows.filter((incident) => isOpenIncident(incident.attributes ?? {}))
  for (const incident of openRows) {
    const attrs = incident.attributes ?? {}
    status = worst(status, mapZendeskImpact(attrs.impact, attrs))
  }

  const included = incidents.included ?? []
  for (const link of included) {
    const attrs = link.attributes
    if (!attrs || attrs.resolvedAt || attrs.serviceId == null) continue
    const targetId = String(attrs.serviceParentId ?? attrs.serviceId)
    const component = componentById.get(targetId)
    if (!component) continue
    const painted = mapZendeskImpact(null, attrs)
    component.status = worst(component.status, painted === "unknown" ? "degraded" : painted)
  }

  const openIncident = mappedIncidents.find((incident) => incident.status !== "resolved")

  return {
    status,
    incidentTitle: openIncident?.title ?? null,
    detail: {
      source: "zendesk",
      openIncidents: openRows.length,
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

export function zendeskIncidentsUrl(asOfDate: string, daysBack = 30): string {
  return `${ZENDESK_STATUS_PAGE}/api/ssp/incidents.json?as_of_date=${asOfDate}&days_back=${daysBack}`
}

/**
 * Fetch and map live Zendesk state from the public SSP JSON.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchZendeskState(options: FetchOptions): Promise<MappedServiceState> {
  const asOfDate = new Date().toISOString().slice(0, 10)
  const services = await fetchJson<ZendeskList<ZendeskServiceAttrs>>(
    ZENDESK_SERVICES_API,
    options,
  )
  if (!services || typeof services !== "object" || !Array.isArray(services.data)) {
    throw new Error(`Unexpected Zendesk services payload from ${ZENDESK_SERVICES_API}`)
  }

  let incidents: ZendeskList<ZendeskIncidentAttrs> = { data: [], included: [] }
  try {
    incidents = await fetchJson<ZendeskList<ZendeskIncidentAttrs>>(
      zendeskIncidentsUrl(asOfDate),
      options,
    )
  } catch (err) {
    console.warn(`[zendesk] incidents fetch failed: ${(err as Error).message}`)
  }

  return mapZendesk(services, incidents, { maxIncidents: options.maxIncidents })
}
