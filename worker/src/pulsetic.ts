/**
 * Pulsetic public status-page fetcher (SMA-45: Kissmetrics).
 *
 * status.kissmetrics.io is a Vue SPA. The page POSTs
 * `https://api.pulsetic.com/public/status/{domain}` (same path the SPA
 * uses in findBySlugOrDomain) and gets monitors + incidents. Do not treat
 * the seed snapshot as live.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export const PULSETIC_API_ORIGIN = "https://api.pulsetic.com"

export type PulseticMonitor = {
  id?: number | string
  name?: string
  status?: string
  order?: number
  disabled?: number | boolean
}

export type PulseticIncident = {
  id?: number | string
  title?: string
  name?: string
  status?: string
  started_at?: string | null
  starts_at?: string | null
  ends_at?: string | null
  resolved_at?: string | null
}

export type PulseticPage = {
  id?: number | string
  title?: string
  slug?: string
  domain?: string
  monitors?: PulseticMonitor[] | null
  incidents?: PulseticIncident[] | null
  live_maintenances?: PulseticIncident[] | null
  upcoming_maintenances?: PulseticIncident[] | null
}

export type PulseticEnvelope = {
  data?: PulseticPage
}

const CLOSED_STATUSES = new Set(["resolved", "completed", "postmortem"])

export function mapPulseticMonitorStatus(status: string | undefined | null): ServiceStatus {
  switch ((status ?? "").toLowerCase()) {
    case "online":
    case "up":
    case "operational":
      return "operational"
    case "degraded":
    case "partial":
      return "degraded"
    case "offline":
    case "down":
    case "outage":
      return "major_outage"
    case "maintenance":
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

function mapIncident(item: PulseticIncident, fallbackStatus: string): MappedIncident | null {
  const title = (item.title ?? item.name ?? "").trim()
  if (!title || item.id == null) return null
  const status = (item.status ?? fallbackStatus).toLowerCase()
  const closed = CLOSED_STATUSES.has(status) || Boolean(item.resolved_at ?? item.ends_at)
  return {
    externalId: String(item.id),
    title,
    status: closed ? "resolved" : status,
    impact: null,
    url: null,
    startedAt: toIso(item.started_at ?? item.starts_at),
    resolvedAt: closed ? toIso(item.resolved_at ?? item.ends_at) : null,
  }
}

/** Map a Pulsetic public status payload into our normalized shape. */
export function mapPulseticPage(page: PulseticPage, pageUrl: string): MappedServiceState {
  const monitors = (page.monitors ?? []).filter((monitor) => monitor && !monitor.disabled)
  const components: MappedComponent[] = monitors
    .filter((monitor) => monitor.id != null && monitor.name)
    .map((monitor) => ({
      externalId: String(monitor.id),
      name: monitor.name as string,
      status: mapPulseticMonitorStatus(monitor.status),
      position: typeof monitor.order === "number" ? monitor.order : null,
    }))

  if (components.length === 0) {
    throw new Error(`Pulsetic page for ${pageUrl} had no monitors`)
  }

  const incidents: MappedIncident[] = []
  for (const item of page.incidents ?? []) {
    const mapped = mapIncident(item, "investigating")
    if (mapped) incidents.push(mapped)
  }
  for (const item of page.live_maintenances ?? []) {
    const mapped = mapIncident(item, "in_progress")
    if (mapped) incidents.push({ ...mapped, impact: "maintenance" })
  }

  const open = incidents.find((incident) => incident.resolvedAt == null)
  const fromMaintenance = (page.live_maintenances ?? []).length > 0 ? "maintenance" : "operational"

  return {
    status: worstStatus([
      worstStatus(components.map((component) => component.status)),
      fromMaintenance,
    ]),
    incidentTitle: open?.title ?? null,
    detail: {
      source: "pulsetic",
      pageTitle: page.title ?? null,
      slug: page.slug ?? null,
      domain: page.domain ?? null,
      pageUrl,
    },
    components,
    incidents,
  }
}

/**
 * POST the Pulsetic public status path the SPA uses (`public/status/{host}`).
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchPulseticState(
  statusHost: string,
  options: FetchOptions,
  pageUrl?: string,
): Promise<MappedServiceState> {
  const host = statusHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")
  const url = `${PULSETIC_API_ORIGIN}/public/status/${host}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": options.userAgent,
    },
    body: JSON.stringify({ password: null }),
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`POST ${url} -> HTTP ${res.status}`)
  }
  const body = (await res.json()) as PulseticEnvelope
  const page = body?.data
  if (!page || typeof page !== "object") {
    throw new Error(`Unexpected Pulsetic payload from ${url}`)
  }
  return mapPulseticPage(page, pageUrl ?? `https://${host}/`)
}
