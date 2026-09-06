/**
 * Uptime Kuma public status-page fetcher + mapper (SMA-68, Blender).
 *
 * Official JSON is `/api/status-page/{slug}` (groups + monitors) and
 * `/api/status-page/heartbeat/{slug}` (latest probe per monitor).
 * Blender's slug is `public`. Heartbeat is populated (unlike Countly).
 * Overall status is the worst latest heartbeat. Informational pinned
 * notices stay in the incident list but do not paint the card.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const BLENDER_STATUS_PAGE = "https://status.blender.org"
export const BLENDER_STATUS_SLUG = "public"

/** Uptime Kuma heartbeat.status: 0 down, 1 up, 2 pending, 3 maintenance. */
export const UPTIME_KUMA_DOWN = 0
export const UPTIME_KUMA_UP = 1
export const UPTIME_KUMA_PENDING = 2
export const UPTIME_KUMA_MAINTENANCE = 3

export type UptimeKumaMonitor = {
  id?: number
  name?: string
  sendUrl?: number
  type?: string
  url?: string
}

export type UptimeKumaGroup = {
  id?: number
  name?: string
  weight?: number
  monitorList?: UptimeKumaMonitor[] | null
}

export type UptimeKumaIncident = {
  id?: number
  style?: string | null
  title?: string | null
  content?: string | null
  pin?: boolean
  createdDate?: string | null
  lastUpdatedDate?: string | null
}

export type UptimeKumaMaintenance = {
  id?: number
  title?: string | null
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  status?: number | null
}

export type UptimeKumaPage = {
  config?: { slug?: string; title?: string } | null
  incidents?: UptimeKumaIncident[] | null
  publicGroupList?: UptimeKumaGroup[] | null
  maintenanceList?: UptimeKumaMaintenance[] | null
}

export type UptimeKumaHeartbeat = {
  status?: number
  time?: string | null
  msg?: string | null
  ping?: number | null
}

export type UptimeKumaHeartbeatPayload = {
  heartbeatList?: Record<string, UptimeKumaHeartbeat[]> | null
  uptimeList?: Record<string, number> | null
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

export function mapUptimeKumaHeartbeatStatus(
  status: number | undefined | null,
): ServiceStatus {
  switch (status) {
    case UPTIME_KUMA_UP:
      return "operational"
    case UPTIME_KUMA_DOWN:
      return "major_outage"
    case UPTIME_KUMA_MAINTENANCE:
      return "maintenance"
    case UPTIME_KUMA_PENDING:
      return "unknown"
    default:
      return "unknown"
  }
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z")
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function latestHeartbeat(
  beats: UptimeKumaHeartbeat[] | undefined,
): UptimeKumaHeartbeat | null {
  if (!beats || beats.length === 0) return null
  return beats[beats.length - 1] ?? null
}

export type MapUptimeKumaOptions = {
  maxIncidents?: number
  pageUrl?: string
}

/**
 * Map an Uptime Kuma public page + heartbeat dump.
 * Components are monitors (not groups). A missing heartbeat is unknown
 * and does not delete the component.
 */
export function mapUptimeKuma(
  page: UptimeKumaPage,
  heartbeat: UptimeKumaHeartbeatPayload,
  options: MapUptimeKumaOptions = {},
): MappedServiceState {
  const pageUrl = (options.pageUrl ?? BLENDER_STATUS_PAGE).replace(/\/+$/, "")
  const monitors: UptimeKumaMonitor[] = []
  for (const group of page.publicGroupList ?? []) {
    for (const monitor of group.monitorList ?? []) {
      if (monitor.id != null && monitor.name) monitors.push(monitor)
    }
  }
  if (monitors.length === 0) {
    throw new Error("Uptime Kuma status page had no monitors")
  }

  const heartbeats = heartbeat.heartbeatList ?? {}
  const components: MappedComponent[] = monitors.map((monitor, index) => {
    const latest = latestHeartbeat(heartbeats[String(monitor.id)])
    return {
      externalId: String(monitor.id),
      name: monitor.name as string,
      status: mapUptimeKumaHeartbeatStatus(latest?.status),
      position: index,
    }
  })

  let status: ServiceStatus = "operational"
  for (const component of components) {
    if (component.status === "unknown") continue
    status = worst(status, component.status)
  }

  const incidents: MappedIncident[] = []
  for (const incident of page.incidents ?? []) {
    if (incident.id == null || !incident.title) continue
    const style = (incident.style ?? "").toLowerCase()
    const paints = style === "danger" || style === "warning"
    const impact: ServiceStatus =
      style === "danger" ? "major_outage" : style === "warning" ? "degraded" : "unknown"
    if (paints) status = worst(status, impact)
    incidents.push({
      externalId: `incident-${incident.id}`,
      title: incident.title,
      status: paints ? "investigating" : "update",
      impact: paints ? impact : null,
      url: pageUrl,
      startedAt: toIso(incident.createdDate),
      resolvedAt: null,
    })
  }

  for (const window of page.maintenanceList ?? []) {
    if (window.id == null || !window.title) continue
    const live = window.status === 1
    if (live) status = worst(status, "maintenance")
    incidents.push({
      externalId: `maint-${window.id}`,
      title: window.title,
      status: live ? "in_progress" : "scheduled",
      impact: live ? "maintenance" : null,
      url: pageUrl,
      startedAt: toIso(window.startDate),
      resolvedAt: live ? null : toIso(window.endDate),
    })
  }

  const mapped = incidents.slice(0, options.maxIncidents ?? 25)
  const headline = mapped.find(
    (incident) => incident.status === "investigating" || incident.status === "in_progress",
  )

  return {
    status,
    incidentTitle: headline?.title ?? null,
    detail: {
      source: "uptime_kuma",
      slug: page.config?.slug ?? null,
      title: page.config?.title ?? null,
      monitorCount: components.length,
    },
    components,
    incidents: mapped,
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

export function uptimeKumaPageUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/status-page/${slug}`
}

export function uptimeKumaHeartbeatUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/status-page/heartbeat/${slug}`
}

/**
 * Fetch and map live Uptime Kuma state for one public status page.
 * Throws on network error, timeout, non-2xx, or an empty monitor list.
 */
export async function fetchUptimeKumaState(
  baseUrl: string,
  slug: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = baseUrl.replace(/\/+$/, "")
  const [page, heartbeat] = await Promise.all([
    fetchJson<UptimeKumaPage>(uptimeKumaPageUrl(root, slug), options),
    fetchJson<UptimeKumaHeartbeatPayload>(uptimeKumaHeartbeatUrl(root, slug), options),
  ])
  if (!page || typeof page !== "object" || !Array.isArray(page.publicGroupList)) {
    throw new Error(`Unexpected Uptime Kuma page payload from ${root}`)
  }
  if (!heartbeat || typeof heartbeat !== "object" || !heartbeat.heartbeatList) {
    throw new Error(`Unexpected Uptime Kuma heartbeat payload from ${root}`)
  }
  if (Object.keys(heartbeat.heartbeatList).length === 0) {
    throw new Error(`Uptime Kuma heartbeat list was empty from ${root}`)
  }
  return mapUptimeKuma(page, heartbeat, {
    maxIncidents: options.maxIncidents,
    pageUrl: root,
  })
}

export async function fetchBlenderState(options: FetchOptions): Promise<MappedServiceState> {
  return fetchUptimeKumaState(BLENDER_STATUS_PAGE, BLENDER_STATUS_SLUG, options)
}
