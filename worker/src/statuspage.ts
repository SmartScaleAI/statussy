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
  /** True for Statuspage group headers (not leaf components). */
  group?: boolean
  group_id?: string | null
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
  components?: Array<{ id?: string; name?: string }> | null
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

export const STATUS_SEVERITY_RANK: Record<ServiceStatus, number> = {
  operational: 0,
  unknown: 1,
  maintenance: 2,
  degraded: 3,
  partial_outage: 4,
  major_outage: 5,
}

export function worstStatus(statuses: Iterable<ServiceStatus>): ServiceStatus {
  let worst: ServiceStatus = "operational"
  for (const status of statuses) {
    if (STATUS_SEVERITY_RANK[status] > STATUS_SEVERITY_RANK[worst]) {
      worst = status
    }
  }
  return worst
}

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
 *
 * Group headers (`group: true`) are dropped (SMA-79): they duplicate their
 * leaf components and inflated the Health denominator on pages like
 * Cloudflare / Datadog / Snowflake. Only leaf components are persisted —
 * same behavior as the group / name-filter mappers.
 */
export function mapStatuspage(
  summary: StatuspageSummary,
  incidents: StatuspageIncident[],
  baseUrl: string,
): MappedServiceState {
  const components: MappedComponent[] = (summary.components ?? [])
    .filter((c) => c.id && c.name && c.group !== true)
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

export type StatuspagePayloads = {
  root: string
  summary: StatuspageSummary
  incidents: StatuspageIncident[]
}

/**
 * Fetch Statuspage summary + incidents without mapping. Shared by the
 * full-page fetcher and the group filter used for Lytics on Contentstack.
 */
export async function fetchStatuspagePayloads(
  baseUrl: string,
  options: FetchOptions,
): Promise<StatuspagePayloads> {
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

  return { root, summary, incidents }
}

/**
 * Fetch and map live state for one Statuspage-compatible service.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchStatuspageState(
  baseUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const { root, summary, incidents } = await fetchStatuspagePayloads(baseUrl, options)
  return mapStatuspage(summary, incidents, root)
}

export type StatuspageGroupFilter = {
  groupId?: string
  groupName?: string
}

export const CONTENTSTACK_STATUS_PAGE = "https://status.contentstack.com"
export const LYTICS_GROUP_ID = "dpv6jsrpvvx2"
export const LYTICS_GROUP_NAME = "Lytics"

/** PSF Statuspage (`status.python.org`). PyPI is one group on that board. */
export const PYTHON_STATUS_PAGE = "https://status.python.org"
export const PYPI_GROUP_ID = "dhqvcb8lvrh1"
export const PYPI_GROUP_NAME = "PyPI"

function stripGroupPrefix(name: string, groupName: string | undefined): string {
  if (!groupName) return name
  const prefix = `${groupName} - `
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

/** Leaf components that belong to a Statuspage group (not the group header). */
export function selectStatuspageGroupComponents(
  components: StatuspageComponent[] | null | undefined,
  filter: StatuspageGroupFilter,
): StatuspageComponent[] {
  const list = components ?? []
  const group = list.find(
    (component) =>
      (filter.groupId != null && component.id === filter.groupId) ||
      (filter.groupName != null && component.group === true && component.name === filter.groupName),
  )
  const groupId = filter.groupId ?? group?.id
  if (!groupId) return []
  return list.filter((component) => component.group_id === groupId && component.group !== true)
}

export function incidentTouchesComponents(
  incident: StatuspageIncident,
  componentIds: Set<string>,
  groupName?: string,
): boolean {
  const comps = incident.components ?? []
  if (comps.some((component) => component.id && componentIds.has(component.id))) {
    return true
  }
  if (groupName) {
    const needle = groupName.toLowerCase()
    if (comps.some((component) => (component.name ?? "").toLowerCase().includes(needle))) {
      return true
    }
    if ((incident.name ?? "").toLowerCase().includes(needle)) {
      return true
    }
  }
  return false
}

/**
 * Map one Statuspage group (e.g. Contentstack → Lytics) as its own card.
 * Overall status comes from the group's leaf components, not the host page.
 */
export function mapStatuspageGroup(
  summary: StatuspageSummary,
  incidents: StatuspageIncident[],
  baseUrl: string,
  filter: StatuspageGroupFilter,
): MappedServiceState {
  const children = selectStatuspageGroupComponents(summary.components, filter)
  if (children.length === 0) {
    throw new Error(
      `No Statuspage components matched group ${filter.groupName ?? filter.groupId ?? "?"} on ${baseUrl}`,
    )
  }

  const group = (summary.components ?? []).find(
    (component) =>
      (filter.groupId != null && component.id === filter.groupId) ||
      (filter.groupName != null && component.group === true && component.name === filter.groupName),
  )
  const componentIds = new Set(children.map((component) => component.id))
  if (group?.id) componentIds.add(group.id)

  const renamed = children.map((component) => ({
    ...component,
    name: stripGroupPrefix(component.name, filter.groupName ?? group?.name),
  }))
  const filteredIncidents = incidents.filter((incident) =>
    incidentTouchesComponents(incident, componentIds, filter.groupName ?? group?.name),
  )

  const mapped = mapStatuspage({ ...summary, components: renamed }, filteredIncidents, baseUrl)
  return {
    ...mapped,
    status: worstStatus(mapped.components.map((component) => component.status)),
    detail: {
      ...mapped.detail,
      source: "statuspage_group",
      groupId: group?.id ?? filter.groupId ?? null,
      groupName: filter.groupName ?? group?.name ?? null,
    },
  }
}

export async function fetchStatuspageGroupState(
  baseUrl: string,
  options: FetchOptions,
  filter: StatuspageGroupFilter,
): Promise<MappedServiceState> {
  const { root, summary, incidents } = await fetchStatuspagePayloads(baseUrl, options)
  return mapStatuspageGroup(summary, incidents, root, filter)
}

export type StatuspageNameFilter = {
  /** Case-insensitive substring matched against component and incident names. */
  nameIncludes: string
}

/** Leaf components whose name mentions the product (not group headers). */
export function selectStatuspageNamedComponents(
  components: StatuspageComponent[] | null | undefined,
  nameIncludes: string,
): StatuspageComponent[] {
  const needle = nameIncludes.toLowerCase()
  return (components ?? []).filter(
    (component) =>
      component.group !== true &&
      Boolean(component.id) &&
      Boolean(component.name) &&
      component.name.toLowerCase().includes(needle),
  )
}

function openIncidentStatus(impact: string | null): ServiceStatus {
  return impact ? mapIndicator(impact) : "degraded"
}

/**
 * Map one product slice of a shared Statuspage (e.g. HashiCorp HCP).
 * Overall status comes from matching components + open incidents, not
 * the host-page HCP rollup. Empty matches stay operational — do not
 * clone the shared indicator.
 */
export function mapStatuspageNameFilter(
  summary: StatuspageSummary,
  incidents: StatuspageIncident[],
  baseUrl: string,
  filter: StatuspageNameFilter,
): MappedServiceState {
  const children = selectStatuspageNamedComponents(summary.components, filter.nameIncludes)
  const componentIds = new Set(children.map((component) => component.id))
  const filteredIncidents = incidents.filter((incident) =>
    incidentTouchesComponents(incident, componentIds, filter.nameIncludes),
  )
  const mapped = mapStatuspage({ ...summary, components: children }, filteredIncidents, baseUrl)
  const fromComponents = worstStatus(mapped.components.map((component) => component.status))
  const fromIncidents = worstStatus(
    mapped.incidents
      .filter((incident) => OPEN_INCIDENT_STATUSES.has(incident.status))
      .map((incident) => openIncidentStatus(incident.impact)),
  )
  return {
    ...mapped,
    status: worstStatus([fromComponents, fromIncidents]),
    detail: {
      ...mapped.detail,
      source: "statuspage_name",
      nameIncludes: filter.nameIncludes,
    },
  }
}

export async function fetchStatuspageNameFilterState(
  baseUrl: string,
  options: FetchOptions,
  filter: StatuspageNameFilter,
): Promise<MappedServiceState> {
  const { root, summary, incidents } = await fetchStatuspagePayloads(baseUrl, options)
  return mapStatuspageNameFilter(summary, incidents, root, filter)
}
