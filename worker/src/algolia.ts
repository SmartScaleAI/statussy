/**
 * Algolia custom status API fetcher (SMA-67 / SMA-51).
 *
 * status.algolia.com is not Statuspage. Live JSON is `/1/status`
 * (cluster → status, ~300 rows) plus `/1/incidents` (per-cluster
 * timestamped events). Overall status is the worst non-operational
 * cluster — Health % will look noisy, same call as Snowflake/Elastic.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const ALGOLIA_STATUS_PAGE = "https://status.algolia.com"
export const ALGOLIA_STATUS_URL = `${ALGOLIA_STATUS_PAGE}/1/status`
export const ALGOLIA_INCIDENTS_URL = `${ALGOLIA_STATUS_PAGE}/1/incidents`

export type AlgoliaClusterStatus = string

export type AlgoliaStatusPayload = {
  status?: Record<string, AlgoliaClusterStatus> | null
}

export type AlgoliaIncidentEvent = {
  t?: number
  v?: {
    title?: string
    status?: string
  } | null
}

export type AlgoliaIncidentsPayload = {
  incidents?: Record<string, AlgoliaIncidentEvent[] | null> | null
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

const CLOSED_STATUSES = new Set(["operational", "resolved", "completed", "postmortem"])

export function mapAlgoliaClusterStatus(
  status: string | undefined | null,
): ServiceStatus {
  switch ((status ?? "").trim().toLowerCase()) {
    case "operational":
    case "none":
      return "operational"
    case "degraded":
    case "degraded_performance":
    case "minor":
      return "degraded"
    case "partial_outage":
    case "major":
      return "partial_outage"
    case "major_outage":
    case "outage":
    case "down":
    case "critical":
      return "major_outage"
    case "maintenance":
    case "under_maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

function toIsoFromMs(ms: number | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

type ClusterIncident = {
  cluster: string
  startedAt: number
  resolvedAt: number | null
  title: string
  status: string
}

/**
 * Walk each cluster's event list (oldest first) and collapse
 * outage → recovery pairs into one incident.
 */
export function collapseAlgoliaIncidents(
  incidents: Record<string, AlgoliaIncidentEvent[] | null>,
): ClusterIncident[] {
  const out: ClusterIncident[] = []
  for (const [cluster, events] of Object.entries(incidents)) {
    const ordered = [...(events ?? [])]
      .filter((event) => typeof event.t === "number" && event.v?.title)
      .sort((a, b) => (a.t as number) - (b.t as number))

    let open: ClusterIncident | null = null
    for (const event of ordered) {
      const raw = event.v?.status ?? "unknown"
      const title = event.v?.title as string
      const t = event.t as number
      if (CLOSED_STATUSES.has(raw.toLowerCase())) {
        if (open) {
          open.resolvedAt = t
          out.push(open)
          open = null
        }
        continue
      }
      if (!open) {
        open = {
          cluster,
          startedAt: t,
          resolvedAt: null,
          title,
          status: raw.toLowerCase(),
        }
      } else {
        open.title = title
        open.status = raw.toLowerCase()
      }
    }
    if (open) out.push(open)
  }
  return out.sort((a, b) => b.startedAt - a.startedAt)
}

export type MapAlgoliaOptions = {
  maxIncidents?: number
}

/**
 * Map Algolia's `/1/status` + `/1/incidents` into normalized state.
 * Overall is any non-operational cluster, not a page-level indicator.
 */
export function mapAlgolia(
  statusPayload: AlgoliaStatusPayload,
  incidentsPayload: AlgoliaIncidentsPayload,
  options: MapAlgoliaOptions = {},
): MappedServiceState {
  const clusters = Object.entries(statusPayload.status ?? {})
  const components: MappedComponent[] = clusters.map(([name, raw], index) => ({
    externalId: name,
    name,
    status: mapAlgoliaClusterStatus(raw),
    position: index,
  }))

  let status: ServiceStatus = "operational"
  for (const component of components) {
    if (component.status === "operational") continue
    status = worst(status, component.status === "unknown" ? "degraded" : component.status)
  }

  const collapsed = collapseAlgoliaIncidents(incidentsPayload.incidents ?? {}).slice(
    0,
    options.maxIncidents ?? 25,
  )

  const mappedIncidents: MappedIncident[] = collapsed.map((incident) => {
    const open = incident.resolvedAt == null
    return {
      externalId: `${incident.cluster}:${incident.startedAt}`,
      title: incident.title,
      status: open ? incident.status : "resolved",
      impact: incident.status === "operational" ? null : incident.status,
      url: ALGOLIA_STATUS_PAGE,
      startedAt: toIsoFromMs(incident.startedAt),
      resolvedAt: open ? null : toIsoFromMs(incident.resolvedAt ?? undefined),
    }
  })

  const openIncident = mappedIncidents.find((incident) => incident.status !== "resolved")
  const downCluster = components.find((component) => component.status !== "operational")

  return {
    status,
    incidentTitle: openIncident?.title ?? (downCluster ? `${downCluster.name} is ${downCluster.status}` : null),
    detail: {
      source: "algolia",
      clusterCount: components.length,
      nonOperationalCount: components.filter((component) => component.status !== "operational").length,
      openIncidentCount: mappedIncidents.filter((incident) => incident.status !== "resolved").length,
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
 * Fetch and map live Algolia state.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 * An incidents failure keeps the status grid (same as Statuspage).
 */
export async function fetchAlgoliaState(options: FetchOptions): Promise<MappedServiceState> {
  const statusPayload = await fetchJson<AlgoliaStatusPayload>(ALGOLIA_STATUS_URL, options)
  if (!statusPayload || typeof statusPayload !== "object" || !statusPayload.status || typeof statusPayload.status !== "object") {
    throw new Error(`Unexpected Algolia status payload from ${ALGOLIA_STATUS_URL}`)
  }

  let incidentsPayload: AlgoliaIncidentsPayload = { incidents: {} }
  try {
    incidentsPayload = await fetchJson<AlgoliaIncidentsPayload>(ALGOLIA_INCIDENTS_URL, options)
  } catch (err) {
    console.warn(`[algolia] incidents fetch failed: ${(err as Error).message}`)
  }

  return mapAlgolia(statusPayload, incidentsPayload, { maxIncidents: options.maxIncidents })
}
