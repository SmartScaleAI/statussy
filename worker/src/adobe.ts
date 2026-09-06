/**
 * Adobe status fetcher + mapper (SMA-68, Design).
 *
 * status.adobe.com is a custom SPA (no Statuspage /api/v2). Live JSON is
 * `data.status.adobe.com/adobestatus/SnowServiceRegistry` (clouds /
 * products) and `StatusEvents` (incident + maintenance history).
 * Overall status is the worst open product incident / started
 * maintenance. Closed and dismissed events do not paint the card.
 * Scheduled future maintenance does not paint either.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const ADOBE_STATUS_PAGE = "https://status.adobe.com"
export const ADOBE_REGISTRY_URL =
  "https://data.status.adobe.com/adobestatus/SnowServiceRegistry"
export const ADOBE_EVENTS_URL =
  "https://data.status.adobe.com/adobestatus/StatusEvents"

export type AdobeNamed = {
  id?: string
  name?: string
}

export type AdobeProduct = AdobeNamed & {
  productServices?: string[] | null
}

export type AdobeRegistry = {
  clouds?: Record<string, AdobeNamed> | null
  products?: Record<string, AdobeProduct> | null
}

export type AdobeEventHistory = {
  status?: string | null
  csoStatus?: string | null
  severity?: string | null
  titleToken?: string | null
  messageToken?: string | null
  statusTime?: number | null
  messageTime?: number | null
}

export type AdobeEventProduct = AdobeNamed & {
  startedOn?: number | null
  endedOn?: number | null
  history?: Record<string, AdobeEventHistory> | null
}

export type AdobeIncident = {
  id?: string
  clouds?: Record<string, AdobeNamed> | null
  products?: Record<string, AdobeEventProduct> | null
}

export type AdobeMaintenance = {
  id?: string
  status?: string | null
  cmrStatus?: string | null
  scheduledDate?: number | null
  startedOn?: number | null
  completedOn?: number | null
  products?: Record<string, AdobeEventProduct> | null
}

export type AdobeLocalizedMessage = {
  token?: string
  textMessage?: string
}

export type AdobeEvents = {
  incidentEvent?: {
    incidents?: Record<string, AdobeIncident> | null
    messages?: Record<string, Record<string, AdobeLocalizedMessage>> | null
  } | null
  maintenanceEvent?: {
    maintenance?: Record<string, AdobeMaintenance> | null
    messages?: Record<string, Record<string, AdobeLocalizedMessage>> | null
  } | null
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

const OPEN_HISTORY = new Set(["opened", "discovery"])
const CLOSED_HISTORY = new Set(["closed", "dismissed", "completed", "canceled", "cancelled"])

export function mapAdobeSeverity(severity: string | null | undefined): ServiceStatus {
  switch ((severity ?? "").toLowerCase()) {
    case "trivial":
    case "minor":
      return "degraded"
    case "major":
      return "partial_outage"
    case "critical":
      return "major_outage"
    case "potential":
      return "unknown"
    default:
      return "unknown"
  }
}

export function latestAdobeHistory(
  product: AdobeEventProduct | undefined,
): AdobeEventHistory | null {
  const history = product?.history
  if (!history) return null
  let latest: AdobeEventHistory | null = null
  let latestTime = -1
  for (const [key, entry] of Object.entries(history)) {
    const time =
      entry.statusTime ??
      entry.messageTime ??
      (Number.isFinite(Number(key)) ? Number(key) : -1)
    if (time >= latestTime) {
      latestTime = time
      latest = entry
    }
  }
  return latest
}

export function isAdobeHistoryOpen(entry: AdobeEventHistory | null): boolean {
  if (!entry) return false
  const status = (entry.status ?? entry.csoStatus ?? "").toLowerCase()
  if (CLOSED_HISTORY.has(status)) return false
  return OPEN_HISTORY.has(status)
}

function fromUnix(value: number | null | undefined): string | null {
  if (value == null || value === 0) return null
  const ms = value > 1e12 ? value : value * 1000
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function englishMessages(
  messages: Record<string, Record<string, AdobeLocalizedMessage>> | null | undefined,
): Record<string, string> {
  const locale = messages?.en ?? {}
  const out: Record<string, string> = {}
  for (const [token, row] of Object.entries(locale)) {
    if (row.textMessage) out[token] = row.textMessage
  }
  return out
}

function lookupTitle(
  token: string | null | undefined,
  messages: Record<string, string>,
  fallback: string,
): string {
  if (token && messages[token]) return messages[token]
  return fallback
}

export type MapAdobeOptions = {
  maxIncidents?: number
}

/**
 * Map Adobe's registry + events into our normalized snapshot shape.
 * Components are products (Photoshop, Express, …), not the 19k environments.
 */
export function mapAdobe(
  registry: AdobeRegistry,
  events: AdobeEvents,
  options: MapAdobeOptions = {},
): MappedServiceState {
  const products = Object.values(registry.products ?? {}).filter(
    (product): product is AdobeProduct & { id: string; name: string } =>
      Boolean(product.id && product.name),
  )
  if (products.length === 0) {
    throw new Error("Adobe registry had no products")
  }

  const components: MappedComponent[] = products.map((product, index) => ({
    externalId: product.id,
    name: product.name,
    status: "operational",
    position: index,
  }))
  const componentById = new Map(components.map((component) => [component.externalId, component]))

  const incidentMessages = englishMessages(events.incidentEvent?.messages)
  const mappedIncidents: MappedIncident[] = []
  let status: ServiceStatus = "operational"

  for (const incident of Object.values(events.incidentEvent?.incidents ?? {})) {
    if (!incident.id) continue
    const openProducts: AdobeEventProduct[] = []
    let severity: ServiceStatus = "unknown"
    let titleToken: string | null = null
    let startedOn: number | null = null
    for (const product of Object.values(incident.products ?? {})) {
      const last = latestAdobeHistory(product)
      if (!isAdobeHistoryOpen(last)) continue
      openProducts.push(product)
      const painted = mapAdobeSeverity(last?.severity)
      severity = worst(severity, painted === "unknown" ? "degraded" : painted)
      titleToken = last?.titleToken ?? titleToken
      if (product.startedOn && (startedOn == null || product.startedOn < startedOn)) {
        startedOn = product.startedOn
      }
      const component = product.id ? componentById.get(product.id) : undefined
      if (component) {
        component.status = worst(
          component.status,
          painted === "unknown" ? "degraded" : painted,
        )
      }
    }
    if (openProducts.length === 0) continue
    status = worst(status, severity)
    const productName = openProducts[0]?.name ?? "Adobe"
    mappedIncidents.push({
      externalId: incident.id,
      title: lookupTitle(titleToken, incidentMessages, `${productName} issue`),
      status: "investigating",
      impact: severity === "operational" ? null : severity,
      url: ADOBE_STATUS_PAGE,
      startedAt: fromUnix(startedOn),
      resolvedAt: null,
    })
  }

  const maintenanceMessages = englishMessages(events.maintenanceEvent?.messages)
  for (const maintenance of Object.values(events.maintenanceEvent?.maintenance ?? {})) {
    if (!maintenance.id) continue
    const state = (maintenance.status ?? maintenance.cmrStatus ?? "").toLowerCase()
    if (state !== "started") continue
    status = worst(status, "maintenance")
    let titleToken: string | null = null
    const names: string[] = []
    for (const product of Object.values(maintenance.products ?? {})) {
      if (product.name) names.push(product.name)
      titleToken = latestAdobeHistory(product)?.titleToken ?? titleToken
      const component = product.id ? componentById.get(product.id) : undefined
      if (component) component.status = worst(component.status, "maintenance")
    }
    mappedIncidents.push({
      externalId: maintenance.id,
      title: lookupTitle(
        titleToken,
        maintenanceMessages,
        names[0] ? `${names[0]} maintenance` : "Adobe maintenance",
      ),
      status: "in_progress",
      impact: "maintenance",
      url: ADOBE_STATUS_PAGE,
      startedAt: fromUnix(maintenance.startedOn ?? maintenance.scheduledDate),
      resolvedAt: null,
    })
  }

  const incidents = mappedIncidents.slice(0, options.maxIncidents ?? 25)
  const headline = incidents.find((incident) => incident.status !== "resolved")

  return {
    status,
    incidentTitle: headline?.title ?? null,
    detail: {
      source: "adobe",
      cloudCount: Object.keys(registry.clouds ?? {}).length,
      productCount: components.length,
      openIncidents: incidents.filter((incident) => incident.status !== "resolved").length,
    },
    components,
    incidents,
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
 * Fetch and map live Adobe state from SnowServiceRegistry + StatusEvents.
 * Throws on network error, timeout, non-2xx, or an empty product catalog.
 */
export async function fetchAdobeState(options: FetchOptions): Promise<MappedServiceState> {
  const timeoutMs = Math.max(options.timeoutMs, 45_000)
  const fetchOpts = { ...options, timeoutMs }
  const [registry, events] = await Promise.all([
    fetchJson<AdobeRegistry>(ADOBE_REGISTRY_URL, fetchOpts),
    fetchJson<AdobeEvents>(ADOBE_EVENTS_URL, fetchOpts),
  ])
  if (!registry || typeof registry !== "object" || !registry.products) {
    throw new Error(`Unexpected Adobe registry payload from ${ADOBE_REGISTRY_URL}`)
  }
  if (!events || typeof events !== "object") {
    throw new Error(`Unexpected Adobe events payload from ${ADOBE_EVENTS_URL}`)
  }
  return mapAdobe(registry, events, { maxIncidents: options.maxIncidents })
}
