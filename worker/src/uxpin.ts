/**
 * UXPin status fetcher + mapper (SMA-68, Design).
 *
 * Dedicated board is status.uxpin.com. Live JSON is
 * `https://api.uxpin.com/status/services` (named services + 90-day
 * uptime history). There is no incident feed: a failing service
 * becomes a synthetic open incident so drop-outs can resolve at
 * persist time.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const UXPIN_STATUS_PAGE = "https://status.uxpin.com"
export const UXPIN_SERVICES_API = "https://api.uxpin.com/status/services"

export type UxpinService = {
  service?: string
  ok?: boolean
  http_code?: number | null
  response_time_ms?: number | null
  checked_at?: string | null
}

export type UxpinHistoryDay = {
  day?: string
  uptime_pct?: number | null
}

export type UxpinStatus = {
  generated_at?: string
  services?: UxpinService[] | null
  history?: Record<string, UxpinHistoryDay[]> | null
}

const DISPLAY_NAMES: Record<string, string> = {
  editor: "Editor",
  preview: "Preview",
  dashboard: "Dashboard",
  api: "API",
  wire: "Wire",
}

export function uxpinServiceName(id: string): string {
  return DISPLAY_NAMES[id] ?? id.replace(/(^|[_-])([a-z])/g, (_, _sep: string, ch: string) => {
    return `${_sep ? " " : ""}${ch.toUpperCase()}`
  })
}

export type MapUxpinOptions = {
  maxIncidents?: number
}

/**
 * Map UXPin's public services payload. `ok: false` is a major outage
 * for that service; overall is the worst check.
 */
export function mapUxpin(
  payload: UxpinStatus,
  options: MapUxpinOptions = {},
): MappedServiceState {
  const rows = (payload.services ?? []).filter(
    (row): row is UxpinService & { service: string } => Boolean(row.service),
  )
  if (rows.length === 0) {
    throw new Error("UXPin status payload had no services")
  }

  const components: MappedComponent[] = rows.map((row, index) => ({
    externalId: row.service,
    name: uxpinServiceName(row.service),
    status: row.ok === false ? "major_outage" : "operational",
    position: index,
  }))

  const failing = rows.filter((row) => row.ok === false)
  const incidents: MappedIncident[] = failing
    .slice(0, options.maxIncidents ?? 25)
    .map((row) => ({
      externalId: `uxpin-${row.service}`,
      title: `${uxpinServiceName(row.service)} is not responding`,
      status: "investigating",
      impact: "major_outage",
      url: UXPIN_STATUS_PAGE,
      startedAt: row.checked_at ?? payload.generated_at ?? null,
      resolvedAt: null,
    }))

  const status: ServiceStatus = failing.length > 0 ? "major_outage" : "operational"

  return {
    status,
    incidentTitle: incidents[0]?.title ?? null,
    detail: {
      source: "uxpin",
      generatedAt: payload.generated_at ?? null,
      failingCount: failing.length,
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
 * Fetch and map live UXPin state.
 * Throws on network error, timeout, non-2xx, or an empty service list.
 */
export async function fetchUxpinState(options: FetchOptions): Promise<MappedServiceState> {
  const payload = await fetchJson<UxpinStatus>(UXPIN_SERVICES_API, options)
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.services)) {
    throw new Error(`Unexpected UXPin status payload from ${UXPIN_SERVICES_API}`)
  }
  return mapUxpin(payload, { maxIncidents: options.maxIncidents })
}
