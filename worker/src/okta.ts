/**
 * Okta Trust HTML / Salesforce-status fetcher (SMA-62).
 *
 * status.okta.com is a Salesforce Experience board. Statuspage JSON, RSS,
 * and summary.json all 401. okta.statuspage.io is not Okta's page. The
 * homepage HTML embeds Salesforce `Incident__c` rows (and planned-outage /
 * cell lists) in hidden `data-id` spans. Parse that payload only — no
 * extra Salesforce routes.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export const OKTA_STATUS_PAGE = "https://status.okta.com/"

/** Browser-like UA. Salesforce Edge is less reliable with bot UAs. */
export const OKTA_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

const CLOSED_STATUSES = new Set([
  "resolved",
  "closed",
  "completed",
  "complete",
  "postmortem",
])

const MAINTENANCE_STATUSES = new Set(["scheduled", "in progress", "in_progress", "maintenance"])

export type OktaIncident = {
  Id?: string
  Name?: string
  Status__c?: string | null
  Category__c?: string | null
  Incident_Title__c?: string | null
  Title__c?: string | null
  Impacted_Cells__c?: string | null
  Service_Feature__c?: string | null
  Okta_Sub_Service__c?: string | null
  Start_Time__c?: string | null
  Start_Date__c?: string | null
  End_Date__c?: string | null
  End_Time__c?: string | null
  Last_Updated__c?: string | null
  CreatedDate?: string | null
  Is_Mis_Red__c?: boolean | null
}

export type OktaPage = {
  incidents: OktaIncident[]
  plannedOutages: OktaIncident[]
  cells: string[]
}

export type OktaFetchOptions = FetchOptions & {
  fetchImpl?: typeof fetch
}

function dataSpanRe(dataId: string): RegExp {
  return new RegExp(`<span[^>]*data-id="${dataId}"[^>]*>([\\s\\S]*?)</span>`, "i")
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function incidentTimeMs(incident: OktaIncident): number {
  const raw =
    incident.Last_Updated__c ??
    incident.Start_Time__c ??
    incident.CreatedDate ??
    incident.Start_Date__c ??
    ""
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function parseJsonSpan<T>(html: string, dataId: string, label: string): T {
  const match = html.match(dataSpanRe(dataId))
  if (!match) {
    throw new Error(`Okta status HTML had no data-id="${dataId}" payload`)
  }
  const raw = match[1].trim()
  if (!raw) {
    return (dataId === "cellList" ? "" : []) as T
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`Okta ${label} was not valid JSON`)
  }
}

function parseCellList(html: string): string[] {
  const match = html.match(dataSpanRe("cellList"))
  if (!match) return []
  return match[1]
    .split(",")
    .map((cell) => cell.trim())
    .filter(Boolean)
}

export function parseOktaHtml(html: string): OktaPage {
  const incidents = parseJsonSpan<OktaIncident[]>(html, "incidents", "incidents")
  if (!Array.isArray(incidents)) {
    throw new Error("Okta incidents payload was not an array")
  }
  let plannedOutages: OktaIncident[] = []
  try {
    const parsed = parseJsonSpan<OktaIncident[]>(html, "planned-outages", "planned-outages")
    if (Array.isArray(parsed)) plannedOutages = parsed
  } catch (err) {
    if ((err as Error).message.includes("was not valid JSON")) throw err
  }
  return {
    incidents,
    plannedOutages,
    cells: parseCellList(html),
  }
}

/** Salesforce Status__c → open / resolved / maintenance. */
export function isOktaResolved(status: string | null | undefined): boolean {
  return CLOSED_STATUSES.has((status ?? "").trim().toLowerCase())
}

export function isOktaMaintenanceStatus(status: string | null | undefined): boolean {
  return MAINTENANCE_STATUSES.has((status ?? "").trim().toLowerCase())
}

/** Salesforce Category__c → our service_status enum. */
export function mapOktaCategory(category: string | null | undefined): ServiceStatus {
  const normalized = (category ?? "").trim().toLowerCase()
  if (!normalized) return "unknown"
  if (normalized.includes("maintenance") || normalized.includes("planned")) {
    return "maintenance"
  }
  if (normalized.includes("major")) return "major_outage"
  if (
    normalized === "service disruption" ||
    normalized === "minor service disruption" ||
    normalized === "feature disruption"
  ) {
    return "partial_outage"
  }
  if (
    normalized === "service degradation" ||
    normalized === "performance issue" ||
    normalized.includes("degrad") ||
    normalized.includes("performance")
  ) {
    return "degraded"
  }
  if (normalized.includes("disruption") || normalized.includes("outage")) {
    return "partial_outage"
  }
  return "unknown"
}

function incidentTitle(incident: OktaIncident): string | null {
  const title = (
    incident.Incident_Title__c ??
    incident.Title__c ??
    incident.Name ??
    ""
  ).trim()
  return title || null
}

function splitCells(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(/[;,]/)
    .map((cell) => cell.trim())
    .filter(Boolean)
}

function isOpenIncident(incident: OktaIncident): boolean {
  return !isOktaResolved(incident.Status__c)
}

function paintsCard(incident: OktaIncident): boolean {
  return isOpenIncident(incident)
}

function rollupStatus(incident: OktaIncident): ServiceStatus {
  if (!paintsCard(incident)) return "operational"
  if (isOktaMaintenanceStatus(incident.Status__c)) return "maintenance"
  const fromCategory = mapOktaCategory(incident.Category__c)
  if (incident.Is_Mis_Red__c === true) {
    return worstStatus([fromCategory === "unknown" ? "major_outage" : fromCategory, "major_outage"])
  }
  return fromCategory === "unknown" ? "degraded" : fromCategory
}

function mappedIncidentStatus(incident: OktaIncident): string {
  if (isOktaResolved(incident.Status__c)) return "resolved"
  const raw = (incident.Status__c ?? "").trim().toLowerCase().replace(/\s+/g, "_")
  if (isOktaMaintenanceStatus(incident.Status__c)) return raw || "in_progress"
  return raw || "investigating"
}

function collectCells(page: OktaPage): string[] {
  const seen = new Set<string>(page.cells)
  for (const incident of [...page.incidents, ...page.plannedOutages]) {
    for (const cell of splitCells(incident.Impacted_Cells__c)) seen.add(cell)
  }
  return [...seen]
}

export type MapOktaOptions = {
  maxIncidents?: number
}

/**
 * Map parsed Okta Trust spans into our normalized service state.
 * Overall status is the worst open Incident__c / planned outage.
 * Cells from cellList (plus any mentioned on open rows) are components.
 */
export function mapOkta(page: OktaPage, options: MapOktaOptions = {}): MappedServiceState {
  const incidents = [...page.incidents, ...page.plannedOutages]
    .filter((incident) => incident.Id && incidentTitle(incident))
    .sort((a, b) => incidentTimeMs(b) - incidentTimeMs(a))
    .slice(0, options.maxIncidents ?? 25)

  const cells = collectCells(page)
  const affected = new Map<string, ServiceStatus>()
  let status: ServiceStatus = "operational"
  for (const incident of incidents) {
    const mapped = rollupStatus(incident)
    if (mapped !== "operational") status = worstStatus([status, mapped])
    if (paintsCard(incident)) {
      for (const cell of splitCells(incident.Impacted_Cells__c)) {
        affected.set(cell, worstStatus([affected.get(cell) ?? "operational", mapped]))
      }
    }
  }

  const components: MappedComponent[] = cells.map((cell, index) => ({
    externalId: cell,
    name: cell,
    status: affected.get(cell) ?? "operational",
    position: index,
  }))

  const mappedIncidents: MappedIncident[] = incidents.map((incident) => {
    const resolved = isOktaResolved(incident.Status__c)
    return {
      externalId: String(incident.Id),
      title: incidentTitle(incident) as string,
      status: mappedIncidentStatus(incident),
      impact: incident.Category__c ?? null,
      url: OKTA_STATUS_PAGE,
      startedAt: toIso(incident.Start_Time__c ?? incident.Start_Date__c ?? incident.CreatedDate),
      resolvedAt: resolved
        ? toIso(incident.End_Time__c ?? incident.End_Date__c ?? incident.Last_Updated__c)
        : null,
    }
  })

  const headline = incidents.find((incident) => paintsCard(incident))

  return {
    status,
    incidentTitle: headline ? incidentTitle(headline) : null,
    detail: {
      source: "okta",
      openIncidentCount: incidents.filter((incident) => isOpenIncident(incident)).length,
      cellCount: cells.length,
    },
    components,
    incidents: mappedIncidents,
  }
}

function htmlUserAgent(configured: string): string {
  return configured.toLowerCase().startsWith("mozilla/") ? configured : OKTA_BROWSER_UA
}

/**
 * Fetch and map live Okta state from the official Trust HTML.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchOktaState(options: OktaFetchOptions): Promise<MappedServiceState> {
  const fetchImpl = options.fetchImpl ?? fetch
  const res = await fetchImpl(OKTA_STATUS_PAGE, {
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "user-agent": htmlUserAgent(options.userAgent),
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${OKTA_STATUS_PAGE} -> HTTP ${res.status}`)
  }
  const html = await res.text()
  return mapOkta(parseOktaHtml(html), { maxIncidents: options.maxIncidents })
}
