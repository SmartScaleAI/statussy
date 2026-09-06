/**
 * Salesforce Trust API fetcher (SMA-66).
 *
 * Official JSON is `https://api.status.salesforce.com/v1` (products +
 * incidents). Do not persist the instance/pod catalog — Health % would
 * become hundreds of sandbox and production rows. We roll up
 * Salesforce Services and Experience Cloud only. Heroku and Slack have
 * their own cards. Upcoming maintenance does not paint the card.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export const SALESFORCE_TRUST_API = "https://api.status.salesforce.com/v1"
export const SALESFORCE_STATUS_PAGE = "https://status.salesforce.com"

/** Products that drive the Salesforce card. Not the instance list. */
export const SALESFORCE_ROLLUP_PRODUCT_KEYS = [
  "Salesforce_Services",
  "Community_Cloud",
] as const

const ROLLUP_KEYS = new Set<string>(SALESFORCE_ROLLUP_PRODUCT_KEYS)

/** Products that already have (or wait on) their own Statussy card. */
const EXCLUDED_PRODUCT_KEYS = new Set(["Heroku", "Slack"])

export type SalesforceProduct = {
  key?: string
  name?: string
  altDisplayName?: string
  url?: string
  order?: number
  isActive?: boolean
  incidentCount?: number
  maintenanceCount?: number
}

export type SalesforceService = {
  key?: string
  isCore?: boolean
  Products?: Array<{ key?: string }> | null
}

export type SalesforceIncidentImpact = {
  startTime?: string | null
  endTime?: string | null
  type?: string | null
  severity?: string | null
}

export type SalesforceIncidentEvent = {
  id?: number | string
  type?: string | null
  message?: string | null
  createdAt?: string | null
}

export type SalesforceTimelineEntry = {
  title?: string | null
  content?: string | null
  createdAt?: string | null
  entryType?: string | null
}

export type SalesforceIncident = {
  id?: number | string
  externalId?: string | null
  status?: string | null
  type?: string | null
  isCore?: boolean
  createdAt?: string | null
  updatedAt?: string | null
  instanceKeys?: string[] | null
  serviceKeys?: string[] | null
  IncidentImpacts?: SalesforceIncidentImpact[] | null
  IncidentEvents?: SalesforceIncidentEvent[] | null
  timeline?: SalesforceTimelineEntry[] | null
}

export type SalesforceTrustPayload = {
  products: SalesforceProduct[]
  incidents: SalesforceIncident[]
  /** serviceKey → product keys. Optional; missing map includes all actives. */
  serviceProducts?: Record<string, string[]>
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function firstSentence(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim()
  const match = compact.match(/^(.+?[.!?])(?:\s|$)/)
  const sentence = (match?.[1] ?? compact).trim()
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence
}

export function mapSalesforceType(type: string | null | undefined): ServiceStatus {
  switch ((type ?? "").trim().toLowerCase()) {
    case "ok":
    case "available":
      return "operational"
    case "degradation":
    case "degraded":
    case "featureperfdegradation":
      return "degraded"
    case "disruption":
    case "servicedisruption":
    case "partial_outage":
      return "partial_outage"
    case "outage":
    case "serviceoutage":
    case "unavailable":
      return "major_outage"
    case "maintenance":
    case "servicemaintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

export function mapSalesforceImpactSeverity(
  severity: string | null | undefined,
): ServiceStatus {
  switch ((severity ?? "").trim().toLowerCase()) {
    case "minor":
      return "degraded"
    case "major":
      return "partial_outage"
    case "critical":
      return "major_outage"
    default:
      return "unknown"
  }
}

export function isSalesforceIncidentOpen(incident: SalesforceIncident): boolean {
  if ((incident.status ?? "").toLowerCase() === "resolved") return false
  const impacts = incident.IncidentImpacts ?? []
  if (impacts.some((impact) => impact.endTime == null || impact.endTime === "")) {
    return true
  }
  return (incident.status ?? "").toLowerCase() === "active"
}

function incidentSeverity(incident: SalesforceIncident): ServiceStatus {
  const signals: ServiceStatus[] = [mapSalesforceType(incident.type)]
  for (const impact of incident.IncidentImpacts ?? []) {
    signals.push(mapSalesforceType(impact.type))
    signals.push(mapSalesforceImpactSeverity(impact.severity))
  }
  const worst = worstStatus(signals)
  return worst === "unknown" ? "degraded" : worst
}

export function salesforceIncidentTitle(incident: SalesforceIncident): string {
  const events = [...(incident.IncidentEvents ?? [])].sort((a, b) => {
    return Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? "")
  })
  for (const event of events) {
    const message = (event.message ?? "").trim()
    if (message.length > 12 && message.toLowerCase() !== (event.type ?? "").toLowerCase()) {
      return firstSentence(message)
    }
  }
  const timeline = [...(incident.timeline ?? [])].sort((a, b) => {
    return Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? "")
  })
  for (const entry of timeline) {
    const content = (entry.content ?? "").trim()
    if (content.length > 12 && content.toLowerCase() !== (entry.title ?? "").toLowerCase()) {
      return firstSentence(content)
    }
  }
  if (incident.type) return `${incident.type} incident`
  return `Salesforce incident ${incident.id ?? "unknown"}`
}

export function incidentProductKeys(
  incident: SalesforceIncident,
  serviceProducts: Record<string, string[]> | undefined,
): string[] {
  const keys = new Set<string>()
  for (const serviceKey of incident.serviceKeys ?? []) {
    for (const productKey of serviceProducts?.[serviceKey] ?? []) {
      keys.add(productKey)
    }
  }
  if (incident.isCore) keys.add("Salesforce_Services")
  return [...keys]
}

export function incidentTouchesRollup(
  incident: SalesforceIncident,
  serviceProducts: Record<string, string[]> | undefined,
): boolean {
  const products = incidentProductKeys(incident, serviceProducts)
  if (products.length === 0) {
    // No map (or unmapped service): keep the incident on this card unless
    // it is exclusive to a product that already has its own Statussy row.
    if (!serviceProducts || Object.keys(serviceProducts).length === 0) return true
    return (incident.serviceKeys ?? []).length === 0
  }
  if (products.every((key) => EXCLUDED_PRODUCT_KEYS.has(key))) return false
  return products.some((key) => ROLLUP_KEYS.has(key))
}

function rollupProducts(products: SalesforceProduct[]): SalesforceProduct[] {
  const byKey = new Map<string, SalesforceProduct>()
  for (const product of products) {
    if (product.key) byKey.set(product.key, product)
  }
  return SALESFORCE_ROLLUP_PRODUCT_KEYS.map((key) => byKey.get(key)).filter(
    (product): product is SalesforceProduct => Boolean(product?.key && product.name),
  )
}

/**
 * Map Trust products + incidents. Components are the two rollup products
 * only — never the instance list.
 */
export function mapSalesforce(payload: SalesforceTrustPayload): MappedServiceState {
  const rollup = rollupProducts(payload.products)
  if (rollup.length === 0) {
    throw new Error("Salesforce Trust products payload had no rollup products")
  }

  const incidents = payload.incidents.filter(
    (incident) => incident.id != null && incidentTouchesRollup(incident, payload.serviceProducts),
  )

  const painted = new Map<string, ServiceStatus>()
  for (const incident of incidents) {
    if (!isSalesforceIncidentOpen(incident)) continue
    const severity = incidentSeverity(incident)
    const productKeys = incidentProductKeys(incident, payload.serviceProducts)
    const targets = productKeys.filter((key) => ROLLUP_KEYS.has(key))
    const applyTo = targets.length > 0 ? targets : [...ROLLUP_KEYS]
    for (const key of applyTo) {
      painted.set(key, worstStatus([painted.get(key) ?? "operational", severity]))
    }
  }

  const components: MappedComponent[] = rollup.map((product, index) => {
    const fromIncident = painted.get(product.key as string)
    let status: ServiceStatus = fromIncident ?? "operational"
    if (!fromIncident && (product.incidentCount ?? 0) > 0) {
      // Counts say this product is impacted but no incident mapped here.
      status = "degraded"
    }
    return {
      externalId: product.key as string,
      name: product.altDisplayName || (product.name as string),
      status,
      position: typeof product.order === "number" ? product.order : index,
    }
  })

  const mappedIncidents: MappedIncident[] = incidents.map((incident) => {
    const open = isSalesforceIncidentOpen(incident)
    const ended = (incident.IncidentImpacts ?? []).find((impact) => impact.endTime)?.endTime
    return {
      externalId: String(incident.id),
      title: salesforceIncidentTitle(incident),
      status: open ? (incident.status ?? "active").toLowerCase() : "resolved",
      impact: incident.type ?? null,
      url: `${SALESFORCE_STATUS_PAGE}/incidents/${incident.id}`,
      startedAt: toIso(incident.createdAt),
      resolvedAt: open ? null : toIso(ended ?? incident.updatedAt),
    }
  })

  const headline = incidents.find((incident) => isSalesforceIncidentOpen(incident))

  return {
    status: worstStatus(components.map((component) => component.status)),
    incidentTitle: headline ? salesforceIncidentTitle(headline) : null,
    detail: {
      source: "salesforce",
      rollupProducts: components.map((component) => component.externalId),
      activeIncidents: mappedIncidents.filter((incident) => incident.resolvedAt == null).length,
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

function serviceProductMap(services: SalesforceService[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const service of services) {
    if (!service.key) continue
    const keys = (service.Products ?? [])
      .map((product) => product.key)
      .filter((key): key is string => Boolean(key))
    if (keys.length > 0) map[service.key] = keys
  }
  return map
}

/**
 * Fetch Trust products + active incidents. Services are best-effort so we
 * can attach incidents to the rollup products without loading instances.
 */
export async function fetchSalesforceState(
  options: FetchOptions,
): Promise<MappedServiceState> {
  const products = await fetchJson<SalesforceProduct[]>(
    `${SALESFORCE_TRUST_API}/products`,
    options,
  )
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error(`Unexpected Salesforce products payload from ${SALESFORCE_TRUST_API}`)
  }

  const incidents = await fetchJson<SalesforceIncident[]>(
    `${SALESFORCE_TRUST_API}/incidents/active`,
    options,
  )
  if (!Array.isArray(incidents)) {
    throw new Error(`Unexpected Salesforce incidents payload from ${SALESFORCE_TRUST_API}`)
  }

  let serviceProducts: Record<string, string[]> | undefined
  try {
    const services = await fetchJson<SalesforceService[]>(
      `${SALESFORCE_TRUST_API}/services`,
      options,
    )
    if (Array.isArray(services)) serviceProducts = serviceProductMap(services)
  } catch (err) {
    console.warn(`[salesforce] services fetch failed: ${(err as Error).message}`)
  }

  return mapSalesforce({
    products,
    incidents: incidents.slice(0, options.maxIncidents ?? 25),
    serviceProducts,
  })
}
