/**
 * GitLab.com status fetcher + mapper (Developer Wave A).
 *
 * status.gitlab.com is Status.io, not Statuspage. The public JSON is
 * `https://api.status.io/1.0/status/{pageId}` (page id documented by GitLab
 * infra / Status.io). Upcoming maintenance does not paint the card.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const GITLAB_STATUS_PAGE = "https://status.gitlab.com"
export const GITLAB_STATUS_PAGE_ID = "5b36dc6502d06804c08349f7"
export const GITLAB_STATUS_API = `https://api.status.io/1.0/status/${GITLAB_STATUS_PAGE_ID}`

export const NEON_STATUS_PAGE = "https://neonstatus.com"
export const NEON_STATUS_PAGE_ID = "6878fc85709daa75be6c7e3c"

export type StatusIoComponent = {
  id?: string
  name?: string
  status?: string
  status_code?: number
}

export type StatusIoIncident = {
  _id?: string
  id?: string
  name?: string
  datetime_open?: string | null
  datetime_resolved?: string | null
  current_status?: string
  current_state?: string
  messages?: Array<{ details?: string; state?: number; datetime?: string }> | null
}

export type StatusIoMaintenance = {
  _id?: string
  id?: string
  name?: string
  datetime_open?: string | null
  datetime_planned_start?: string | null
  datetime_planned_end?: string | null
}

export type StatusIoResult = {
  status_overall?: { status?: string; status_code?: number; updated?: string }
  status?: StatusIoComponent[] | null
  incidents?: StatusIoIncident[] | null
  maintenance?: {
    active?: StatusIoMaintenance[] | null
    upcoming?: StatusIoMaintenance[] | null
  } | null
}

export type StatusIoPayload = {
  result?: StatusIoResult | null
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

/**
 * Status.io component / overall status_code (and label) -> our enum.
 * Codes: 100 operational, 200 maintenance, 300 degraded, 400 partial,
 * 500 disruption, 600 security event.
 */
export function mapStatusIoCode(
  code: number | undefined,
  label?: string | undefined,
): ServiceStatus {
  if (typeof code === "number") {
    switch (code) {
      case 100:
        return "operational"
      case 200:
        return "maintenance"
      case 300:
        return "degraded"
      case 400:
        return "partial_outage"
      case 500:
      case 600:
        return "major_outage"
      default:
        break
    }
  }
  switch ((label ?? "").toLowerCase()) {
    case "operational":
      return "operational"
    case "planned maintenance":
    case "maintenance":
      return "maintenance"
    case "degraded performance":
    case "degraded":
      return "degraded"
    case "partial service disruption":
      return "partial_outage"
    case "service disruption":
    case "security event":
    case "security issue":
      return "major_outage"
    default:
      return "unknown"
  }
}

function incidentState(incident: StatusIoIncident): string {
  const last = incident.messages?.at(-1)
  if (typeof last?.state === "number") {
    switch (last.state) {
      case 100:
        return "investigating"
      case 200:
        return "identified"
      case 300:
        return "monitoring"
      case 400:
        return "resolved"
      default:
        break
    }
  }
  return (incident.current_state ?? "investigating").toLowerCase()
}

function isResolvedIncident(incident: StatusIoIncident): boolean {
  if (incident.datetime_resolved) return true
  return incidentState(incident) === "resolved"
}

export type MapGitlabOptions = {
  maxIncidents?: number
  pageUrl?: string
  pageId?: string
}

/**
 * Map GitLab's Status.io public JSON into our normalized service state.
 * Overall status is the page-level status_overall, then worst component,
 * then active maintenance.
 */
export function mapGitlab(
  payload: StatusIoPayload,
  options: MapGitlabOptions = {},
): MappedServiceState {
  const result = payload.result
  if (!result) {
    throw new Error("Status.io payload was missing result")
  }
  const pageUrl = options.pageUrl ?? GITLAB_STATUS_PAGE
  const pageId = options.pageId ?? GITLAB_STATUS_PAGE_ID

  const components: MappedComponent[] = (result.status ?? [])
    .filter((component) => component.id && component.name)
    .map((component, index) => ({
      externalId: component.id as string,
      name: component.name as string,
      status: mapStatusIoCode(component.status_code, component.status),
      position: index,
    }))

  let status = mapStatusIoCode(
    result.status_overall?.status_code,
    result.status_overall?.status,
  )
  if (status === "unknown") status = "operational"
  for (const component of components) {
    const mapped = component.status === "unknown" ? "operational" : component.status
    status = worst(status, mapped)
  }

  const incidents = [...(result.incidents ?? [])]
    .filter((incident) => (incident._id ?? incident.id) && incident.name)
    .slice(0, options.maxIncidents ?? 25)

  const mappedIncidents: MappedIncident[] = incidents.map((incident) => {
    const resolved = isResolvedIncident(incident)
    const id = String(incident._id ?? incident.id)
    return {
      externalId: id,
      title: incident.name as string,
      status: resolved ? "resolved" : incidentState(incident),
      impact: incident.current_status ? incident.current_status.toLowerCase() : null,
      url: `${pageUrl}/pages/incident/${pageId}/${id}`,
      startedAt: toIso(incident.datetime_open),
      resolvedAt: resolved ? toIso(incident.datetime_resolved) : null,
    }
  })

  const activeMaintenance = result.maintenance?.active ?? []
  if (activeMaintenance.length > 0) {
    status = worst(status, "maintenance")
    for (const window of activeMaintenance) {
      const id = window._id ?? window.id
      const title = window.name
      if (!id || !title) continue
      mappedIncidents.push({
        externalId: String(id),
        title,
        status: "in_progress",
        impact: "maintenance",
        url: pageUrl,
        startedAt: toIso(window.datetime_planned_start ?? window.datetime_open),
        resolvedAt: null,
      })
    }
  }

  const openTitle = mappedIncidents.find((incident) => incident.status !== "resolved")?.title
  const maintenanceTitle = activeMaintenance[0]?.name ?? null

  return {
    status,
    incidentTitle: openTitle ?? maintenanceTitle,
    detail: {
      source: "status_io",
      pageUrl,
      overall: result.status_overall?.status ?? null,
      overallCode: result.status_overall?.status_code ?? null,
      activeMaintenanceCount: activeMaintenance.length,
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
 * Fetch and map a Status.io public status page.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchStatusIoState(
  pageUrl: string,
  pageId: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const api = `https://api.status.io/1.0/status/${pageId}`
  const payload = await fetchJson<StatusIoPayload>(api, options)
  if (!payload?.result || !payload.result.status_overall) {
    throw new Error(`Unexpected Status.io payload from ${api}`)
  }
  return mapGitlab(payload, {
    maxIncidents: options.maxIncidents,
    pageUrl,
    pageId,
  })
}

/**
 * Fetch and map live GitLab.com state from the Status.io public API.
 */
export async function fetchGitlabState(options: FetchOptions): Promise<MappedServiceState> {
  return fetchStatusIoState(GITLAB_STATUS_PAGE, GITLAB_STATUS_PAGE_ID, options)
}
