/**
 * PagerDuty status fetcher + mapper (SMA-74 / SMA-58).
 *
 * status.pagerduty.com is PagerDuty's own status page (not Statuspage).
 * `/api/v2/summary.json` 404s. The public JSON the SPA loads is:
 *   GET /api/services            — named US/EU components
 *   GET /api/impacted_services   — currently impacted rows (empty = operational)
 *
 * Impact rows carry `service_id` + `impact_severity_id`. Severity IDs are
 * the page's `/api/post_enums` keys (incident/impacts/*, maintenance/impacts/*).
 * We map the published IDs plus name/key fallbacks; do not call /api/posts
 * or scrape the SPA. Failures throw so the worker can mark the snapshot stale.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const PAGERDUTY_STATUS_PAGE = "https://status.pagerduty.com"
export const PAGERDUTY_SERVICES_API = `${PAGERDUTY_STATUS_PAGE}/api/services`
export const PAGERDUTY_IMPACTED_API = `${PAGERDUTY_STATUS_PAGE}/api/impacted_services`

export type PagerDutyFetchOptions = FetchOptions & {
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
}

export type PagerDutyService = {
  id?: string
  name?: string
  display_name?: string
  is_active?: boolean
  status_page_id?: string
  business_service_id?: string
}

export type PagerDutyImpactedService = {
  service_id?: string
  id?: string
  business_service_id?: string
  impact_severity_id?: string
  severity_id?: string
  name?: string
  display_name?: string
  title?: string
  post_id?: string
  post_type?: string
  rank?: number
  layout_settings?: { key?: string } | null
}

export type PagerDutyServicesPayload = {
  services?: PagerDutyService[] | null
}

export type PagerDutyImpactedPayload = {
  status_page_id?: string
  impacted_services?: PagerDutyImpactedService[] | null
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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

/**
 * Published impact enum IDs from status.pagerduty.com `/api/post_enums`
 * (incident/impacts/* and maintenance/impacts/*). Name/key fallbacks cover
 * a page that ships new IDs or embeds the label on the impact row.
 */
const IMPACT_BY_ID: Record<string, ServiceStatus> = {
  PH7XL8Z: "partial_outage", // incident/impacts/partial_outage
  PDY9KW9: "major_outage", // incident/impacts/outage
  PKGILKM: "operational", // incident/impacts/operational
  P194FYD: "maintenance", // maintenance/impacts/maintenance
  P4ISGO3: "operational", // maintenance/impacts/operational
  P5WKMQ5: "degraded", // incident/severity/minor
  P1KZLAF: "partial_outage", // incident/severity/major
  P96902V: "operational", // incident/severity/all_good
  P8UDH0T: "maintenance", // maintenance/severity/maintenance
  PP41HCG: "operational", // maintenance/severity/all_good
}

function normalizeLabel(value: string): string {
  const last = value.includes("/") ? (value.split("/").pop() ?? value) : value
  return last.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
}

/** PagerDuty impact enum / name / key → our service_status. */
export function mapPagerDutyImpact(
  impact: string | undefined | null,
  impactId?: string | undefined | null,
): ServiceStatus {
  const id = (impactId ?? "").toUpperCase()
  if (id && IMPACT_BY_ID[id]) return IMPACT_BY_ID[id]

  switch (normalizeLabel(impact ?? "")) {
    case "operational":
    case "all good":
    case "none":
      return "operational"
    case "minor":
    case "degraded":
    case "degraded performance":
      return "degraded"
    case "partial outage":
    case "major":
      return "partial_outage"
    case "outage":
    case "major outage":
    case "critical":
      return "major_outage"
    case "maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

function impactLabel(row: PagerDutyImpactedService): string | null {
  return (
    asString(row.name) ??
    asString(row.display_name) ??
    asString(row.title) ??
    asString(row.layout_settings?.key)
  )
}

function impactId(row: PagerDutyImpactedService): string | null {
  return asString(row.impact_severity_id) ?? asString(row.severity_id)
}

function impactedServiceId(row: PagerDutyImpactedService): string | null {
  return asString(row.service_id) ?? asString(row.id)
}

function serviceName(service: PagerDutyService): string | null {
  return asString(service.display_name) ?? asString(service.name)
}

export type MapPagerDutyOptions = {
  maxIncidents?: number
}

/**
 * Map PagerDuty `/api/services` + `/api/impacted_services` into our
 * normalized shape. Empty `impacted_services` is operational. Overall
 * status is the worst painted component. Impact rows without a post
 * title do not invent incidents.
 */
export function mapPagerDuty(
  servicesPayload: PagerDutyServicesPayload,
  impactedPayload: PagerDutyImpactedPayload,
  options: MapPagerDutyOptions = {},
): MappedServiceState {
  const impacts = impactedPayload.impacted_services ?? []
  const statusByServiceId = new Map<string, ServiceStatus>()
  for (const row of impacts) {
    const serviceId = impactedServiceId(row)
    const painted = mapPagerDutyImpact(impactLabel(row), impactId(row))
    const status = painted === "unknown" ? "degraded" : painted
    if (!serviceId) continue
    const current = statusByServiceId.get(serviceId) ?? "operational"
    statusByServiceId.set(serviceId, worst(current, status))
  }

  const services = (servicesPayload.services ?? []).filter(
    (service) => service.id && serviceName(service) && service.is_active !== false,
  )
  if (services.length === 0) {
    throw new Error("PagerDuty /api/services had no active services")
  }

  const components: MappedComponent[] = services.map((service, index) => ({
    externalId: service.id as string,
    name: serviceName(service) as string,
    status: statusByServiceId.get(service.id as string) ?? "operational",
    position: index,
  }))

  let status: ServiceStatus = "operational"
  for (const component of components) {
    status = worst(status, component.status)
  }
  for (const painted of statusByServiceId.values()) {
    status = worst(status, painted)
  }

  const mappedIncidents: MappedIncident[] = impacts
    .filter((row) => (asString(row.post_id) ?? impactedServiceId(row)) && (asString(row.title) ?? asString(row.name)))
    .slice(0, options.maxIncidents ?? 25)
    .map((row) => {
      const painted = mapPagerDutyImpact(impactLabel(row), impactId(row))
      const open = painted !== "operational"
      return {
        externalId: (asString(row.post_id) ?? impactedServiceId(row)) as string,
        title: (asString(row.title) ?? asString(row.name)) as string,
        status: open ? (row.post_type === "maintenance" ? "in_progress" : "investigating") : "resolved",
        impact: painted === "unknown" || painted === "operational" ? null : painted,
        url: PAGERDUTY_STATUS_PAGE,
        startedAt: null,
        resolvedAt: null,
      }
    })

  const headline =
    mappedIncidents.find((incident) => incident.status !== "resolved")?.title ??
    (status !== "operational"
      ? components.find((component) => component.status !== "operational")?.name ?? null
      : null)

  return {
    status,
    incidentTitle: headline,
    detail: {
      source: "pagerduty",
      statusPageId: impactedPayload.status_page_id ?? services[0]?.status_page_id ?? null,
      serviceCount: components.length,
      impactedCount: statusByServiceId.size,
    },
    components,
    incidents: mappedIncidents,
  }
}

async function fetchJson<T>(
  url: string,
  options: PagerDutyFetchOptions,
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch
  const res = await fetchImpl(url, {
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
 * Fetch and map live PagerDuty state from `/api/services` +
 * `/api/impacted_services`. Throws on network error, timeout, non-2xx,
 * or an unparseable / empty services list.
 */
export async function fetchPagerDutyState(
  options: PagerDutyFetchOptions,
): Promise<MappedServiceState> {
  const [services, impacted] = await Promise.all([
    fetchJson<PagerDutyServicesPayload>(PAGERDUTY_SERVICES_API, options),
    fetchJson<PagerDutyImpactedPayload>(PAGERDUTY_IMPACTED_API, options),
  ])
  if (!services || typeof services !== "object" || !Array.isArray(services.services)) {
    throw new Error(`Unexpected PagerDuty services payload from ${PAGERDUTY_SERVICES_API}`)
  }
  if (!impacted || typeof impacted !== "object" || !Array.isArray(impacted.impacted_services)) {
    throw new Error(`Unexpected PagerDuty impacted payload from ${PAGERDUTY_IMPACTED_API}`)
  }
  return mapPagerDuty(services, impacted, { maxIncidents: options.maxIncidents })
}
