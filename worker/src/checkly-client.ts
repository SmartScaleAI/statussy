/**
 * Checkly public client-payload fetcher (SMA-68, LottieFiles).
 *
 * Checkly status pages with `data-ssr="false"` ship an empty
 * `__NUXT_DATA__` (`[{serverRendered:1},false]`). Do not reuse the
 * Mistral `checkly_nuxt` scrape — it would throw on that HTML.
 *
 * The SPA loads unauthenticated JSON from api.checklyhq.com:
 *   GET /v1/status-page/{host}/metadata?type=customDomain
 *   GET /v1/status-page/{id}/statuses?page=&limit=
 *   GET /v1/status-page/{id}/incidents
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const CHECKLY_API_ROOT = "https://api.checklyhq.com"
export const LOTTIEFILES_STATUS_PAGE = "https://status.lottiefiles.com"

export type ChecklyClientFetchOptions = FetchOptions & {
  fetchImpl?: typeof fetch
}

export type ChecklyPageMetadata = {
  id?: number | string
  dashboardId?: string
  header?: string | null
  customDomain?: string | null
  isPrivate?: boolean
  accountId?: string
}

export type ChecklyCheckStatus = {
  hasFailures?: boolean
  hasErrors?: boolean
  isDegraded?: boolean
  updated_at?: string | null
}

export type ChecklyCheck = {
  id?: string
  name?: string
  activated?: boolean
  muted?: boolean
  tags?: string[] | null
  group?: { name?: string | null; activated?: boolean } | null
  status?: ChecklyCheckStatus | null
}

export type ChecklyStatuses = {
  results?: ChecklyCheck[] | null
  summary?: {
    total?: number
    totalPassing?: number
    totalFailing?: number
    totalDegraded?: number
  } | null
}

export type ChecklyIncidentUpdate = {
  id?: string
  status?: string | null
  description?: string | null
}

export type ChecklyClientIncident = {
  id?: string
  name?: string
  impact?: string | null
  startedAt?: string | null
  stoppedAt?: string | null
  created_at?: string | null
  incidentUpdates?: ChecklyIncidentUpdate[] | null
}

const SEVERITY_RANK: Record<ServiceStatus, number> = {
  unknown: 0,
  operational: 1,
  maintenance: 2,
  degraded: 3,
  partial_outage: 4,
  major_outage: 5,
}

function worst(a: ServiceStatus, b: ServiceStatus): ServiceStatus {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a
}

export function mapChecklyCheckStatus(
  status: ChecklyCheckStatus | null | undefined,
): ServiceStatus {
  if (!status) return "unknown"
  if (status.hasFailures || status.hasErrors) return "major_outage"
  if (status.isDegraded) return "degraded"
  return "operational"
}

export function mapChecklyImpact(impact: string | null | undefined): ServiceStatus {
  switch ((impact ?? "").toUpperCase()) {
    case "MINOR":
    case "MEDIUM":
      return "degraded"
    case "MAJOR":
      return "partial_outage"
    case "CRITICAL":
      return "major_outage"
    case "MAINTENANCE":
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

function isOpenIncident(incident: ChecklyClientIncident): boolean {
  return !incident.stoppedAt
}

export type MapChecklyClientOptions = {
  maxIncidents?: number
  pageUrl?: string
}

/**
 * Map Checkly client-payload statuses + incidents. Open incidents
 * (no stoppedAt) paint the card; resolved history rides along.
 */
export function mapChecklyClient(
  checks: ChecklyCheck[],
  incidents: ChecklyClientIncident[],
  options: MapChecklyClientOptions = {},
): MappedServiceState {
  const pageUrl = (options.pageUrl ?? LOTTIEFILES_STATUS_PAGE).replace(/\/+$/, "")
  const activeChecks = checks.filter((check) => check.id && check.name && check.activated !== false)
  if (activeChecks.length === 0) {
    throw new Error("Checkly statuses payload had no activated checks")
  }

  const components: MappedComponent[] = activeChecks.map((check, index) => ({
    externalId: check.id as string,
    name: check.name as string,
    status: mapChecklyCheckStatus(check.status),
    position: index,
  }))

  let status: ServiceStatus = "unknown"
  for (const component of components) {
    status = worst(status, component.status)
  }

  const mappedIncidents: MappedIncident[] = incidents
    .filter((incident) => incident.id && incident.name)
    .slice(0, options.maxIncidents ?? 25)
    .map((incident) => {
      const open = isOpenIncident(incident)
      const impact = mapChecklyImpact(incident.impact)
      const lastUpdate = incident.incidentUpdates?.[0]?.status
      return {
        externalId: incident.id as string,
        title: incident.name as string,
        status: open
          ? (lastUpdate ?? "investigating").toLowerCase()
          : "resolved",
        impact: incident.impact ? incident.impact.toLowerCase() : null,
        url: `${pageUrl}/incidents/${incident.id}`,
        startedAt: toIso(incident.startedAt ?? incident.created_at),
        resolvedAt: open ? null : toIso(incident.stoppedAt),
      }
    })

  for (const incident of incidents) {
    if (!isOpenIncident(incident)) continue
    status = worst(status, mapChecklyImpact(incident.impact))
  }
  if (status === "unknown") status = "operational"

  const headline = mappedIncidents.find((incident) => incident.status !== "resolved")

  return {
    status,
    incidentTitle: headline?.title ?? null,
    detail: {
      source: "checkly_client",
      checkCount: components.length,
      unresolvedCount: mappedIncidents.filter((incident) => incident.status !== "resolved")
        .length,
    },
    components,
    incidents: mappedIncidents,
  }
}

async function fetchJson<T>(
  url: string,
  options: ChecklyClientFetchOptions,
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch
  const res = await fetchImpl(url, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export function checklyPageHost(pageUrl: string): string {
  const host = new URL(pageUrl).host
  if (!host) throw new Error(`Checkly page URL has no host: ${pageUrl}`)
  return host
}

async function fetchAllStatuses(
  pageId: number | string,
  options: ChecklyClientFetchOptions,
): Promise<ChecklyCheck[]> {
  const checks: ChecklyCheck[] = []
  const limit = 50
  let page = 1
  let total = Number.POSITIVE_INFINITY
  while (checks.length < total) {
    const body = await fetchJson<ChecklyStatuses>(
      `${CHECKLY_API_ROOT}/v1/status-page/${pageId}/statuses?page=${page}&limit=${limit}`,
      options,
    )
    const rows = body.results ?? []
    checks.push(...rows)
    total = body.summary?.total ?? checks.length
    if (rows.length === 0) break
    page += 1
    if (page > 20) break
  }
  return checks
}

/**
 * Fetch Checkly client-payload JSON for one public status page.
 * Throws on network error, timeout, non-2xx, or an empty check list.
 */
export async function fetchChecklyClientState(
  pageUrl: string,
  options: ChecklyClientFetchOptions,
): Promise<MappedServiceState> {
  const host = checklyPageHost(pageUrl)
  const metadata = await fetchJson<ChecklyPageMetadata>(
    `${CHECKLY_API_ROOT}/v1/status-page/${host}/metadata?type=customDomain`,
    options,
  )
  if (metadata.isPrivate) {
    throw new Error(`Checkly status page ${host} is private`)
  }
  const pageId = metadata.id
  if (pageId == null) {
    throw new Error(`Checkly metadata for ${host} had no page id`)
  }

  const [checks, incidents] = await Promise.all([
    fetchAllStatuses(pageId, options),
    fetchJson<ChecklyClientIncident[]>(
      `${CHECKLY_API_ROOT}/v1/status-page/${pageId}/incidents`,
      options,
    ).catch((err: Error) => {
      console.warn(`[checkly-client] incidents fetch failed for ${host}: ${err.message}`)
      return [] as ChecklyClientIncident[]
    }),
  ])

  return mapChecklyClient(checks, Array.isArray(incidents) ? incidents : [], {
    maxIncidents: options.maxIncidents,
    pageUrl,
  })
}

export async function fetchLottiefilesState(
  options: ChecklyClientFetchOptions,
): Promise<MappedServiceState> {
  return fetchChecklyClientState(LOTTIEFILES_STATUS_PAGE, options)
}
