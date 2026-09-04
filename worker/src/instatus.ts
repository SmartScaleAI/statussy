/**
 * Instatus fetcher + mapper (SMA-20, Perplexity).
 *
 * Instatus pages expose /summary.json (page status + active incidents +
 * active maintenances) and /components.json. Unlike Statuspage there is no
 * page-level severity indicator: `page.status` is a coarse
 * UP / HASISSUES / UNDERMAINTENANCE, so when the page has issues the overall
 * status is derived from the worst active-incident impact / component status.
 * Active incidents ride along in summary.json, so no RSS fetch is needed;
 * like OnlineOrNot, the feed only lists *active* incidents, so ones that
 * drop out are resolved at persist time (resolveMissingIncidents).
 */
import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedProviderState,
  ProviderStatus,
} from "./statuspage.js"

export type InstatusSummary = {
  page?: { name?: string; url?: string; status?: string }
  activeIncidents?: InstatusActiveIncident[] | null
  activeMaintenances?: InstatusActiveMaintenance[] | null
}

export type InstatusActiveIncident = {
  id: string
  name: string
  /** Vendor lifecycle state: INVESTIGATING | IDENTIFIED | MONITORING | RESOLVED. */
  status?: string
  /** Vendor severity: DEGRADEDPERFORMANCE | PARTIALOUTAGE | MAJOROUTAGE. */
  impact?: string | null
  url?: string | null
  started?: string | null
}

export type InstatusActiveMaintenance = {
  id: string
  name: string
  status?: string
  start?: string | null
  url?: string | null
}

export type InstatusComponent = {
  id: string
  name: string
  status?: string
  description?: string | null
  group?: string | null
}

/**
 * Instatus component statuses and incident impacts share one vocabulary
 * (OPERATIONAL / UNDERMAINTENANCE / DEGRADEDPERFORMANCE / PARTIALOUTAGE /
 * MAJOROUTAGE), so one mapper covers both.
 */
export function mapInstatusComponentStatus(status: string | undefined | null): ProviderStatus {
  switch (status) {
    case "OPERATIONAL":
      return "operational"
    case "DEGRADEDPERFORMANCE":
      return "degraded"
    case "PARTIALOUTAGE":
      return "partial_outage"
    case "MAJOROUTAGE":
      return "major_outage"
    case "UNDERMAINTENANCE":
      return "maintenance"
    default:
      return "unknown"
  }
}

const SEVERITY_RANK: Record<ProviderStatus, number> = {
  operational: 0,
  unknown: 1,
  maintenance: 2,
  degraded: 3,
  partial_outage: 4,
  major_outage: 5,
}

/** Normalize a vendor timestamp to ISO-8601, or null if absent/unparseable. */
function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Map an Instatus summary + component list into our normalized shape. */
export function mapInstatus(
  summary: InstatusSummary,
  components: InstatusComponent[],
): MappedProviderState {
  const mappedComponents: MappedComponent[] = components
    .filter((c) => c.id && c.name)
    .map((c, index) => ({
      externalId: c.id,
      name: c.name,
      status: mapInstatusComponentStatus(c.status),
      // components.json has no explicit ordering field; keep the page order.
      position: index,
    }))

  const activeIncidents = summary.activeIncidents ?? []
  const mappedIncidents: MappedIncident[] = activeIncidents
    .filter((i) => i.id && i.name)
    .map((i) => ({
      externalId: i.id,
      title: i.name,
      status: i.status?.toLowerCase() ?? "unknown",
      impact: i.impact ?? null,
      url: i.url ?? null,
      startedAt: toIso(i.started),
      // summary.json only carries *active* incidents, so never resolved here.
      resolvedAt: null,
    }))

  const pageStatus = summary.page?.status ?? null
  let status: ProviderStatus
  switch (pageStatus) {
    case "UP":
      status = "operational"
      break
    case "UNDERMAINTENANCE":
      status = "maintenance"
      break
    case "HASISSUES": {
      // No page-level severity on Instatus: take the worst signal from
      // active-incident impacts and component statuses.
      const signals: ProviderStatus[] = [
        ...activeIncidents.map((i) => mapInstatusComponentStatus(i.impact)),
        ...mappedComponents.map((c) => c.status),
      ]
      const worst = signals.reduce<ProviderStatus>(
        (acc, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[acc] ? s : acc),
        "operational",
      )
      // The page says something is wrong even if nothing mapped: floor at degraded.
      status = SEVERITY_RANK[worst] >= SEVERITY_RANK.degraded ? worst : "degraded"
      break
    }
    default:
      status = "unknown"
  }

  return {
    status,
    incidentTitle: mappedIncidents[0]?.title ?? null,
    detail: {
      source: "instatus",
      // Raw Instatus page status (UP / HASISSUES / UNDERMAINTENANCE).
      pageStatus,
      pageUrl: summary.page?.url ?? null,
    },
    components: mappedComponents,
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
 * Fetch and map live state for one Instatus provider.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 * components.json is required: persisting an empty component list would
 * delete the last-known components, so a components failure marks the
 * provider stale instead (via the caller's error handling).
 */
export async function fetchInstatusState(
  baseUrl: string,
  options: FetchOptions,
): Promise<MappedProviderState> {
  const root = baseUrl.replace(/\/+$/, "")

  const summary = await fetchJson<InstatusSummary>(`${root}/summary.json`, options)
  if (!summary || typeof summary !== "object" || !summary.page) {
    throw new Error(`Unexpected summary.json payload from ${root}`)
  }

  const componentsBody = await fetchJson<{ components?: InstatusComponent[] }>(
    `${root}/components.json`,
    options,
  )
  if (!componentsBody || !Array.isArray(componentsBody.components)) {
    throw new Error(`Unexpected components.json payload from ${root}`)
  }

  return mapInstatus(summary, componentsBody.components)
}
