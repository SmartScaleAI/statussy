/**
 * incident.io public status-page fetcher (SMA-45: PostHog).
 *
 * Hosts like www.posthogstatus.com expose GET /api/v1/summary with
 * page title, ongoing incidents, and maintenances. There is no component
 * grid — Health stays 1/1 from the overall status. Only *active* incidents
 * appear, so dropped rows are resolved at persist time.
 */

import type { FetchOptions, MappedIncident, MappedServiceState, ServiceStatus } from "./statuspage.js"
import { mapIndicator, worstStatus } from "./statuspage.js"

export type IncidentioIncident = {
  id?: string
  name?: string
  title?: string
  status?: string
  impact?: string | null
  url?: string | null
  permalink?: string | null
  started_at?: string | null
  updated_at?: string | null
  resolved_at?: string | null
}

export type IncidentioSummary = {
  page_title?: string
  page_url?: string
  ongoing_incidents?: IncidentioIncident[] | null
  in_progress_maintenances?: IncidentioIncident[] | null
  scheduled_maintenances?: IncidentioIncident[] | null
}

const CLOSED_STATUSES = new Set(["resolved", "completed", "postmortem"])

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function incidentTitle(item: IncidentioIncident): string | null {
  const title = (item.name ?? item.title ?? "").trim()
  return title || null
}

function incidentUrl(item: IncidentioIncident): string | null {
  return item.url ?? item.permalink ?? null
}

function mapIncident(item: IncidentioIncident, fallbackStatus: string): MappedIncident | null {
  const title = incidentTitle(item)
  const externalId = item.id ?? incidentUrl(item)
  if (!title || !externalId) return null
  const status = (item.status ?? fallbackStatus).toLowerCase()
  const closed = CLOSED_STATUSES.has(status)
  return {
    externalId,
    title,
    status,
    impact: item.impact ?? null,
    url: incidentUrl(item),
    startedAt: toIso(item.started_at),
    resolvedAt: closed ? toIso(item.resolved_at ?? item.updated_at) : null,
  }
}

export function mapIncidentioImpact(impact: string | null | undefined): ServiceStatus {
  switch ((impact ?? "").toLowerCase()) {
    case "none":
    case "operational":
      return "operational"
    case "minor":
      return "degraded"
    case "major":
      return "partial_outage"
    case "critical":
      return "major_outage"
    case "maintenance":
      return "maintenance"
    default:
      return mapIndicator(impact ?? undefined)
  }
}

/** Map an incident.io /api/v1/summary payload into our normalized shape. */
export function mapIncidentioSummary(summary: IncidentioSummary, pageUrl: string): MappedServiceState {
  const ongoing = summary.ongoing_incidents ?? []
  const inProgress = summary.in_progress_maintenances ?? []
  const scheduled = summary.scheduled_maintenances ?? []

  const incidents: MappedIncident[] = []
  for (const item of ongoing) {
    const mapped = mapIncident(item, "investigating")
    if (mapped) incidents.push(mapped)
  }
  for (const item of inProgress) {
    const mapped = mapIncident(item, "in_progress")
    if (mapped) incidents.push({ ...mapped, impact: mapped.impact ?? "maintenance" })
  }
  for (const item of scheduled) {
    const mapped = mapIncident(item, "scheduled")
    if (mapped) incidents.push({ ...mapped, impact: mapped.impact ?? "maintenance" })
  }

  const openHeadline = incidents.find((incident) => !CLOSED_STATUSES.has(incident.status))
  const severities: ServiceStatus[] = []
  if (ongoing.length > 0) {
    for (const item of ongoing) {
      severities.push(item.impact ? mapIncidentioImpact(item.impact) : "degraded")
    }
  } else if (inProgress.length > 0) {
    severities.push("maintenance")
  }

  return {
    status: worstStatus(severities),
    incidentTitle: openHeadline?.title ?? null,
    detail: {
      source: "incidentio",
      pageTitle: summary.page_title ?? null,
      pageUrl: summary.page_url ?? pageUrl,
      ongoingIncidents: ongoing.length,
      inProgressMaintenances: inProgress.length,
      scheduledMaintenances: scheduled.length,
    },
    components: [],
    incidents,
  }
}

/**
 * Fetch and map live state from an incident.io public summary.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchIncidentioState(
  pageUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = pageUrl.replace(/\/+$/, "")
  const url = `${root}/api/v1/summary`
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  const body = (await res.json()) as IncidentioSummary
  if (!body || typeof body !== "object") {
    throw new Error(`Unexpected incident.io summary payload from ${root}`)
  }
  return mapIncidentioSummary(body, root)
}
