/**
 * Fathom Analytics status fetcher (SMA-45).
 *
 * status.usefathom.com exposes GET /json with Dashboard + Ingest monitors
 * and a page-level summarizedStatus. That is enough for a component grid;
 * there is no public incident list on the JSON endpoint.
 */

import type { FetchOptions, MappedComponent, MappedServiceState, ServiceStatus } from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export type FathomMonitor = {
  label?: string
  url?: string
  status?: string
}

export type FathomJson = {
  title?: string
  timezone?: string
  summarizedStatus?: string
  pinnedUpdate?: { title?: string; body?: string } | string | null
  monitors?: Record<string, FathomMonitor[] | unknown> | FathomMonitor[] | null
}

export function mapFathomMonitorStatus(status: string | undefined | null): ServiceStatus {
  switch ((status ?? "").toLowerCase()) {
    case "up":
    case "operational":
      return "operational"
    case "degraded":
    case "partial":
    case "slow":
      return "degraded"
    case "down":
    case "outage":
      return "major_outage"
    case "maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

export function mapFathomSummarizedStatus(status: string | undefined | null): ServiceStatus {
  switch ((status ?? "").toLowerCase()) {
    case "up":
    case "operational":
      return "operational"
    case "degraded":
    case "partial":
    case "mixed":
      return "degraded"
    case "down":
    case "outage":
      return "major_outage"
    case "maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

export function flattenFathomMonitors(monitors: FathomJson["monitors"]): FathomMonitor[] {
  if (!monitors) return []
  if (Array.isArray(monitors)) return monitors.filter((item) => item && typeof item === "object")
  const out: FathomMonitor[] = []
  for (const value of Object.values(monitors)) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (item && typeof item === "object") out.push(item as FathomMonitor)
    }
  }
  return out
}

function pinnedTitle(pinned: FathomJson["pinnedUpdate"]): string | null {
  if (!pinned) return null
  if (typeof pinned === "string") return pinned.trim() || null
  const title = (pinned.title ?? pinned.body ?? "").trim()
  return title || null
}

/** Map status.usefathom.com/json into our normalized shape. */
export function mapFathomJson(payload: FathomJson): MappedServiceState {
  const monitors = flattenFathomMonitors(payload.monitors)
  const components: MappedComponent[] = monitors
    .filter((monitor) => monitor.label)
    .map((monitor, index) => ({
      externalId: monitor.url || monitor.label || String(index),
      name: monitor.label as string,
      status: mapFathomMonitorStatus(monitor.status),
      position: index,
    }))

  const fromMonitors = worstStatus(components.map((component) => component.status))
  const fromSummary = mapFathomSummarizedStatus(payload.summarizedStatus)
  const status = fromSummary === "unknown" ? fromMonitors : worstStatus([fromSummary, fromMonitors])

  return {
    status,
    incidentTitle: status === "operational" ? null : pinnedTitle(payload.pinnedUpdate),
    detail: {
      source: "fathom",
      title: payload.title ?? null,
      summarizedStatus: payload.summarizedStatus ?? null,
      timezone: payload.timezone ?? null,
    },
    components,
    incidents: [],
  }
}

/**
 * Fetch and map live Fathom status JSON.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchFathomState(
  pageUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = pageUrl.replace(/\/+$/, "")
  const url = `${root}/json`
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  const body = (await res.json()) as FathomJson
  if (!body || typeof body !== "object" || !body.summarizedStatus) {
    throw new Error(`Unexpected Fathom /json payload from ${root}`)
  }
  return mapFathomJson(body)
}
