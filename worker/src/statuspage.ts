/**
 * Statuspage-compatible fetcher + mapper (SMA-16).
 *
 * Reads /api/v2/summary.json (overall status + components) and
 * /api/v2/incidents.json (incident history). OpenAI's page is
 * Statuspage-API-compatible but does not embed incidents in summary.json,
 * so incidents are always fetched from the dedicated endpoint.
 */

export type ServiceStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "unknown"

export type StatuspageSummary = {
  page?: { id?: string; name?: string; url?: string; updated_at?: string }
  status?: { indicator?: string; description?: string }
  components?: StatuspageComponent[] | null
}

export type StatuspageComponent = {
  id: string
  name: string
  status?: string
  position?: number
}

export type StatuspageIncident = {
  id: string
  name: string
  status?: string
  impact?: string | null
  shortlink?: string | null
  created_at?: string | null
  started_at?: string | null
  resolved_at?: string | null
}

/** Statuspage page-level indicator -> our service_status enum. */
export function mapIndicator(indicator: string | undefined): ServiceStatus {
  switch (indicator) {
    case "none":
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
      return "unknown"
  }
}

/** Statuspage component status -> our service_status enum. */
export function mapComponentStatus(status: string | undefined): ServiceStatus {
  switch (status) {
    case "operational":
      return "operational"
    case "degraded_performance":
      return "degraded"
    case "partial_outage":
      return "partial_outage"
    case "major_outage":
      return "major_outage"
    case "under_maintenance":
    case "maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

const OPEN_INCIDENT_STATUSES = new Set(["investigating", "identified", "monitoring", "in_progress", "verifying"])

export type MappedComponent = {
  externalId: string
  name: string
  status: ServiceStatus
  position: number | null
}

export type MappedIncident = {
  externalId: string
  title: string
  status: string
  impact: string | null
  url: string | null
  startedAt: string | null
  resolvedAt: string | null
}

/** Fetcher-specific parsed detail stored on each snapshot (jsonb column). */
export type SnapshotDetail = { source: string } & Record<string, unknown>

export type MappedServiceState = {
  status: ServiceStatus
  incidentTitle: string | null
  detail: SnapshotDetail
  components: MappedComponent[]
  incidents: MappedIncident[]
}

/**
 * Map a Statuspage summary + incident list into our normalized shape.
 * `baseUrl` is used to build incident links when the API omits `shortlink`.
 */
export function mapStatuspage(
  summary: StatuspageSummary,
  incidents: StatuspageIncident[],
  baseUrl: string,
): MappedServiceState {
  const components: MappedComponent[] = (summary.components ?? [])
    .filter((c) => c.id && c.name)
    .map((c) => ({
      externalId: c.id,
      name: c.name,
      status: mapComponentStatus(c.status),
      position: typeof c.position === "number" ? c.position : null,
    }))

  const mappedIncidents: MappedIncident[] = incidents
    .filter((i) => i.id && i.name)
    .map((i) => ({
      externalId: i.id,
      title: i.name,
      status: i.status ?? "unknown",
      impact: i.impact ?? null,
      url: i.shortlink ?? `${baseUrl.replace(/\/+$/, "")}/incidents/${i.id}`,
      startedAt: i.started_at ?? i.created_at ?? null,
      resolvedAt: i.resolved_at ?? null,
    }))

  const openIncident = mappedIncidents.find((i) => OPEN_INCIDENT_STATUSES.has(i.status))

  return {
    status: mapIndicator(summary.status?.indicator),
    incidentTitle: openIncident?.title ?? null,
    detail: {
      source: "statuspage",
      indicator: summary.status?.indicator ?? null,
      description: summary.status?.description ?? null,
      pageUpdatedAt: summary.page?.updated_at ?? null,
    },
    components,
    incidents: mappedIncidents,
  }
}

export type FetchOptions = {
  timeoutMs: number
  userAgent: string
  /** Cap on how many incidents (newest first) we upsert per tick. */
  maxIncidents?: number
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
 * Fetch and map live state for one Statuspage-compatible service.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchStatuspageState(
  baseUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = baseUrl.replace(/\/+$/, "")
  const summary = await fetchJson<StatuspageSummary>(`${root}/api/v2/summary.json`, options)
  if (!summary || typeof summary !== "object" || !summary.status) {
    throw new Error(`Unexpected summary.json payload from ${root}`)
  }

  // OpenAI's summary.json omits incidents entirely, so pull them separately.
  // An incidents failure should not discard an otherwise good summary.
  let incidents: StatuspageIncident[] = []
  try {
    const body = await fetchJson<{ incidents?: StatuspageIncident[] }>(
      `${root}/api/v2/incidents.json`,
      options,
    )
    incidents = (body.incidents ?? []).slice(0, options.maxIncidents ?? 25)
  } catch (err) {
    console.warn(`[statuspage] incidents fetch failed for ${root}: ${(err as Error).message}`)
  }

  return mapStatuspage(summary, incidents, root)
}
