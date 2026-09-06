/**
 * Slack Status API fetcher + mapper (Collab Wave A).
 *
 * slack-status.com is not Statuspage. The public JSON is
 * `https://slack-status.com/api/v2.0.0/current` (documented at
 * docs.slack.dev/reference/slack-status-api). Only *active* incidents
 * are listed, so ones that drop out are resolved at persist time.
 * Notices do not paint the card.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const SLACK_STATUS_PAGE = "https://slack-status.com"
export const SLACK_CURRENT_API = `${SLACK_STATUS_PAGE}/api/v2.0.0/current`

export type SlackNote = {
  body?: string
  date_created?: string
}

export type SlackIncident = {
  id?: string | number
  title?: string
  type?: string
  status?: string
  url?: string
  date_created?: string
  date_updated?: string
  services?: string[]
  notes?: SlackNote[]
}

export type SlackCurrent = {
  status?: string
  date_created?: string
  date_updated?: string
  active_incidents?: SlackIncident[] | null
}

const SLACK_SERVICES = [
  "Login/SSO",
  "Messaging",
  "Notifications",
  "Search",
  "Workspace/Org Administration",
  "Canvases",
  "Connectivity",
  "Files",
  "Huddles",
  "Apps/Integrations/APIs",
  "Workflows",
] as const

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

/** Slack incident type / lifecycle -> our service_status enum. */
export function mapSlackType(
  type: string | undefined,
  status?: string | undefined,
): ServiceStatus {
  const lifecycle = (status ?? "").toLowerCase()
  if (
    lifecycle === "scheduled" ||
    lifecycle === "completed" ||
    lifecycle === "cancelled"
  ) {
    return lifecycle === "scheduled" ? "maintenance" : "operational"
  }
  switch ((type ?? "").toLowerCase()) {
    case "outage":
      return "major_outage"
    case "incident":
      return "degraded"
    case "notice":
      return "operational"
    default:
      return "unknown"
  }
}

function isOpenIncident(incident: SlackIncident): boolean {
  const status = (incident.status ?? "").toLowerCase()
  return status === "active" || status === "scheduled" || status === ""
}

/**
 * Map Slack's current-status payload. Notices stay in the incident list
 * but do not roll up the card.
 */
export function mapSlack(payload: SlackCurrent): MappedServiceState {
  const incidents = payload.active_incidents ?? []
  const mappedIncidents: MappedIncident[] = incidents
    .filter((incident) => incident.id != null && incident.title)
    .map((incident) => ({
      externalId: String(incident.id),
      title: incident.title as string,
      status: incident.status ?? "unknown",
      impact: incident.type ?? null,
      url: incident.url ?? null,
      startedAt: toIso(incident.date_created),
      resolvedAt: null,
    }))

  let status: ServiceStatus =
    (payload.status ?? "").toLowerCase() === "ok" ? "operational" : "unknown"
  const affected = new Set<string>()
  let openTitle: string | null = null

  for (const incident of incidents) {
    if (!isOpenIncident(incident)) continue
    const severity = mapSlackType(incident.type, incident.status)
    if (severity === "operational") continue
    status = status === "unknown" ? severity : worst(status, severity)
    if (!openTitle && incident.title) openTitle = incident.title
    for (const service of incident.services ?? []) {
      affected.add(service)
    }
  }

  if ((payload.status ?? "").toLowerCase() === "ok" && !openTitle) {
    status = "operational"
  } else if (status === "unknown" && !openTitle) {
    status = "operational"
  }

  const names = new Set<string>([...SLACK_SERVICES, ...affected])
  const components: MappedComponent[] = [...names].map((name, index) => ({
    externalId: name,
    name,
    status: affected.has(name) ? status : "operational",
    position: index,
  }))

  return {
    status,
    incidentTitle: openTitle,
    detail: {
      source: "slack",
      pageStatus: payload.status ?? null,
      pageUpdatedAt: payload.date_updated ?? null,
      openIncidents: mappedIncidents.length,
    },
    components,
    incidents: mappedIncidents,
  }
}

/**
 * Fetch and map live Slack state from the public Status API.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchSlackState(
  options: FetchOptions,
): Promise<MappedServiceState> {
  const res = await fetch(SLACK_CURRENT_API, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${SLACK_CURRENT_API} -> HTTP ${res.status}`)
  }
  const payload = (await res.json()) as SlackCurrent
  if (!payload || typeof payload !== "object" || !("status" in payload)) {
    throw new Error(`Unexpected Slack status payload from ${SLACK_CURRENT_API}`)
  }
  return mapSlack(payload)
}
