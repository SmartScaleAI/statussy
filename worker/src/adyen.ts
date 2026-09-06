/**
 * Adyen status fetcher (SMA-75).
 *
 * status.adyen.com is a custom Nuxt page. The HTML / `__NUXT_DATA__`
 * payload is cookie chrome only — the SPA loads public JSON:
 *   GET /api/incident-messages/active
 *   GET /api/incident-messages?startDate&endDate&limit
 *   GET /api/maintenance-messages/active?startDate&endDate&currentDate&limit
 *   GET /api/global-data  (component labels)
 *
 * Severity on the page: GREY = operational (external issuer/acquirer
 * notices), YELLOW = degraded, RED = partial outage. Upcoming
 * maintenance is listed but does not paint the card (same as Zendesk).
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export const ADYEN_STATUS_PAGE = "https://status.adyen.com"

export const ADYEN_SYSTEMS = [
  {
    id: "PLATFORM_AVAILABILITY",
    labelKey: "platformAvailability",
    name: "Payments",
  },
  {
    id: "ACQUIRER_PAYMENTS_PERFORMANCE",
    labelKey: "acquirerPaymentsPerformance",
    name: "Payment methods and issuers",
  },
  {
    id: "CUSTOMER_AREA_REPORTING",
    labelKey: "customerAreaReporting",
    name: "Interfaces and reporting",
  },
  {
    id: "SETTLEMENT_PAYOUT",
    labelKey: "settlementPayout",
    name: "Settlement and payouts",
  },
  {
    id: "ADYEN_FOR_PLATFORMS",
    labelKey: "adyenForPlatforms",
    name: "Adyen for Platforms",
  },
  {
    id: "FINANCIAL_PRODUCTS",
    labelKey: "financialProducts",
    name: "Financial products",
  },
] as const

export type AdyenSys = { id?: string }

export type AdyenIncidentStatus = {
  sys?: AdyenSys
  status?: string | null
  date?: string | null
}

export type AdyenIncident = {
  sys?: AdyenSys
  title?: string | null
  date?: string | null
  resolved?: boolean
  systemAffected?: string | null
  severity?: string | null
  incidentStatusCollection?: { items?: AdyenIncidentStatus[] | null } | null
}

export type AdyenMaintenance = {
  sys?: AdyenSys
  title?: string | null
  date?: string | null
  endDate?: string | null
  resolved?: boolean
}

export type AdyenCollection<T> = {
  items?: T[] | null
  total?: number
}

export type AdyenGlobalLabels = Record<string, string | undefined>

export type AdyenPage = {
  labels?: AdyenGlobalLabels | null
  activeIncidents: AdyenIncident[]
  recentIncidents: AdyenIncident[]
  activeMaintenance: AdyenMaintenance[]
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function incidentId(item: AdyenIncident | AdyenMaintenance): string | null {
  return asString(item.sys?.id)
}

function lastUpdateStatus(item: AdyenIncident): string {
  const updates = item.incidentStatusCollection?.items ?? []
  for (let i = updates.length - 1; i >= 0; i--) {
    const status = asString(updates[i]?.status)
    if (status) return status.toLowerCase()
  }
  return item.resolved ? "resolved" : "identified"
}

function resolvedAt(item: AdyenIncident): string | null {
  if (!item.resolved) return null
  const updates = item.incidentStatusCollection?.items ?? []
  for (let i = updates.length - 1; i >= 0; i--) {
    if ((updates[i]?.status ?? "").toUpperCase() === "RESOLVED") {
      return toIso(updates[i]?.date)
    }
  }
  return toIso(item.date)
}

/** Adyen page severity → our service_status enum. GREY is informational. */
export function mapAdyenSeverity(severity: string | undefined | null): ServiceStatus {
  switch ((severity ?? "").toUpperCase()) {
    case "GREY":
      return "operational"
    case "YELLOW":
      return "degraded"
    case "RED":
      return "partial_outage"
    default:
      return "unknown"
  }
}

function systemName(systemId: string, labels: AdyenGlobalLabels | null | undefined): string {
  const known = ADYEN_SYSTEMS.find((system) => system.id === systemId)
  if (!known) return systemId
  const labeled = labels?.[known.labelKey]
  return asString(labeled) ?? known.name
}

function mapIncident(item: AdyenIncident): MappedIncident | null {
  const id = incidentId(item)
  const title = asString(item.title)
  if (!id || !title) return null
  const closed = item.resolved === true
  return {
    externalId: id,
    title,
    status: closed ? "resolved" : lastUpdateStatus(item),
    impact: item.severity ? item.severity.toLowerCase() : null,
    url: `${ADYEN_STATUS_PAGE}/incident-history`,
    startedAt: toIso(item.date),
    resolvedAt: closed ? resolvedAt(item) : null,
  }
}

function mapMaintenance(item: AdyenMaintenance): MappedIncident | null {
  const id = incidentId(item)
  const title = asString(item.title)
  if (!id || !title) return null
  const closed = item.resolved === true
  return {
    externalId: id,
    title,
    status: closed ? "resolved" : "maintenance",
    impact: "maintenance",
    url: `${ADYEN_STATUS_PAGE}/maintenance-messages`,
    startedAt: toIso(item.date),
    resolvedAt: closed ? toIso(item.endDate ?? item.date) : null,
  }
}

function paintsCard(incident: AdyenIncident): boolean {
  return incident.resolved !== true && mapAdyenSeverity(incident.severity) !== "operational"
}

/** Map parsed Adyen API payloads into our normalized snapshot shape. */
export function mapAdyen(page: AdyenPage, maxIncidents = 25): MappedServiceState {
  const labels = page.labels ?? null
  const byId = new Map<string, AdyenIncident>()
  for (const item of [...page.recentIncidents, ...page.activeIncidents]) {
    const id = incidentId(item)
    if (id) byId.set(id, item)
  }

  const incidents: MappedIncident[] = []
  const seen = new Set<string>()
  const pushIncident = (mapped: MappedIncident | null) => {
    if (!mapped || seen.has(mapped.externalId)) return
    seen.add(mapped.externalId)
    incidents.push(mapped)
  }

  for (const item of page.activeIncidents) {
    pushIncident(mapIncident(item))
  }
  for (const window of page.activeMaintenance) {
    pushIncident(mapMaintenance(window))
  }
  const history = [...byId.values()].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  )
  for (const item of history) {
    pushIncident(mapIncident(item))
  }

  const trimmed = incidents.slice(0, maxIncidents)
  const openPainting = page.activeIncidents.filter(paintsCard)
  const status = worstStatus(openPainting.map((item) => mapAdyenSeverity(item.severity)))

  const affected = new Map<string, ServiceStatus>()
  for (const item of openPainting) {
    const system = asString(item.systemAffected)
    if (!system) continue
    const current = affected.get(system) ?? "operational"
    affected.set(system, worstStatus([current, mapAdyenSeverity(item.severity)]))
  }

  const components: MappedComponent[] = ADYEN_SYSTEMS.map((system, index) => ({
    externalId: system.id,
    name: systemName(system.id, labels),
    status: affected.get(system.id) ?? "operational",
    position: index,
  }))

  return {
    status,
    incidentTitle: status === "operational" ? null : (openPainting[0] ? asString(openPainting[0].title) : null),
    detail: {
      source: "adyen",
      pageUrl: ADYEN_STATUS_PAGE,
      activeIncidents: page.activeIncidents.length,
      activeMaintenance: page.activeMaintenance.length,
    },
    components,
    incidents: trimmed,
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

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function isoDaysAhead(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function collectionItems<T>(payload: AdyenCollection<T> | null | undefined): T[] {
  return Array.isArray(payload?.items) ? payload.items : []
}

/**
 * Fetch and map live Adyen state from the public Nuxt `/api` JSON.
 * Throws when the active-incidents endpoint fails so the worker can
 * mark the snapshot stale. History / labels / maintenance are best-effort.
 */
export async function fetchAdyenState(options: FetchOptions): Promise<MappedServiceState> {
  const activeUrl = `${ADYEN_STATUS_PAGE}/api/incident-messages/active`
  const activePayload = await fetchJson<{ incidentMessageCollection?: AdyenCollection<AdyenIncident> }>(
    activeUrl,
    options,
  )
  if (!activePayload || typeof activePayload !== "object" || !activePayload.incidentMessageCollection) {
    throw new Error(`Unexpected Adyen active-incidents payload from ${activeUrl}`)
  }
  const activeIncidents = collectionItems(activePayload.incidentMessageCollection)

  let labels: AdyenGlobalLabels | null = null
  try {
    const global = await fetchJson<{
      globalLabelsCollection?: { items?: AdyenGlobalLabels[] | null }
    }>(`${ADYEN_STATUS_PAGE}/api/global-data`, options)
    labels = global.globalLabelsCollection?.items?.[0] ?? null
  } catch (err) {
    console.warn(`[adyen] global-data failed: ${(err as Error).message}`)
  }

  let recentIncidents: AdyenIncident[] = []
  try {
    const startDate = isoDaysAgo(90)
    const endDate = new Date().toISOString()
    const historyUrl =
      `${ADYEN_STATUS_PAGE}/api/incident-messages` +
      `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&limit=25`
    const history = await fetchJson<{ incidentMessageCollection?: AdyenCollection<AdyenIncident> }>(
      historyUrl,
      options,
    )
    recentIncidents = collectionItems(history.incidentMessageCollection)
  } catch (err) {
    console.warn(`[adyen] incident history failed: ${(err as Error).message}`)
  }

  let activeMaintenance: AdyenMaintenance[] = []
  try {
    const query = new URLSearchParams({
      startDate: isoDaysAgo(30),
      endDate: isoDaysAhead(30),
      currentDate: new Date().toISOString(),
      limit: "25",
    })
    const maintenance = await fetchJson<{
      maintenanceMessageCollection?: AdyenCollection<AdyenMaintenance>
    }>(`${ADYEN_STATUS_PAGE}/api/maintenance-messages/active?${query}`, options)
    activeMaintenance = collectionItems(maintenance.maintenanceMessageCollection)
  } catch (err) {
    console.warn(`[adyen] maintenance failed: ${(err as Error).message}`)
  }

  return mapAdyen(
    { labels, activeIncidents, recentIncidents, activeMaintenance },
    options.maxIncidents,
  )
}
