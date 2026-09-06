/**
 * Hetzner status fetcher + mapper (Cloud Wave C).
 *
 * status.hetzner.com is a Next.js page with no public Statuspage/JSON API.
 * The official HTML embeds `__NEXT_DATA__` with systems plus current
 * information, maintenance, and incident-history lists. We parse that
 * payload only — no extra Hetzner routes.
 *
 * Informational notices (capacity / “other”) stay in the incident list but
 * do not paint the card, matching Google Cloud. Future scheduled
 * maintenance does not paint either. Components are only systems currently
 * affected by an outage or in-progress maintenance — not the full catalog.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const HETZNER_STATUS_PAGE = "https://status.hetzner.com/en"

/** Browser-like UA. The page is a Next.js SPA; bot UAs are less reliable. */
export const HETZNER_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

const NEXT_DATA_RE =
  /<script[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i

const CLOSED_STATES = new Set(["resolved", "completed"])
const ACTIVE_MAINTENANCE_STATES = new Set(["in_progress", "monitoring"])

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

export type HetznerSystem = {
  id?: number
  titleEn?: string
  titleDe?: string
  systemState?: string
  parent?: string | null
}

export type HetznerIncident = {
  id?: number
  uuid?: string
  system?: string
  titleEn?: string
  titleDe?: string
  incidentState?: string
  incidentType?: string
  startTime?: string | null
  endTime?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type HetznerIncidents = {
  topNotification?: HetznerIncident[] | null
  informationList?: HetznerIncident[] | null
  maintenanceList?: HetznerIncident[] | null
  incidentHistory?: HetznerIncident[] | null
}

export type HetznerPage = {
  systems: HetznerSystem[]
  incidents: HetznerIncidents
}

export type MapHetznerOptions = {
  maxIncidents?: number
  now?: Date
}

export type HetznerFetchOptions = FetchOptions & {
  fetchImpl?: typeof fetch
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function parseTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function incidentTitle(incident: HetznerIncident): string | null {
  const title = (incident.titleEn ?? incident.titleDe ?? "").trim()
  return title || (incident.id != null ? String(incident.id) : null)
}

function incidentType(incident: HetznerIncident): string {
  return (incident.incidentType ?? "").toLowerCase()
}

function incidentState(incident: HetznerIncident): string {
  return (incident.incidentState ?? "").toLowerCase()
}

function isResolved(incident: HetznerIncident, now: Date): boolean {
  if (CLOSED_STATES.has(incidentState(incident))) return true
  const end = parseTime(incident.endTime)
  return end != null && end < now && !ACTIVE_MAINTENANCE_STATES.has(incidentState(incident))
}

function isInformational(incident: HetznerIncident): boolean {
  const type = incidentType(incident)
  return type === "other" || type === "information" || type === "info"
}

export function isHetznerActiveMaintenance(
  incident: HetznerIncident,
  now: Date,
): boolean {
  if (incidentType(incident) !== "maintenance") return false
  if (isResolved(incident, now)) return false
  if (ACTIVE_MAINTENANCE_STATES.has(incidentState(incident))) return true
  const start = parseTime(incident.startTime)
  const end = parseTime(incident.endTime)
  if (start && now < start) return false
  if (end && now > end) return false
  return start != null && now >= start
}

export function isHetznerOpenOutage(incident: HetznerIncident, now: Date): boolean {
  if (incidentType(incident) !== "outage") return false
  return !isResolved(incident, now)
}

function paintsCard(incident: HetznerIncident, now: Date): boolean {
  return isHetznerOpenOutage(incident, now) || isHetznerActiveMaintenance(incident, now)
}

function rollupStatus(incident: HetznerIncident, now: Date): ServiceStatus {
  if (isHetznerOpenOutage(incident, now)) return "major_outage"
  if (isHetznerActiveMaintenance(incident, now)) return "maintenance"
  return "operational"
}

function collectIncidents(lists: HetznerIncidents): HetznerIncident[] {
  const byId = new Map<string, HetznerIncident>()
  const add = (incident: HetznerIncident | undefined) => {
    if (incident?.id == null || !incidentTitle(incident)) return
    const key = String(incident.id)
    if (!byId.has(key)) byId.set(key, incident)
  }
  for (const incident of lists.topNotification ?? []) add(incident)
  for (const incident of lists.informationList ?? []) add(incident)
  for (const incident of lists.maintenanceList ?? []) add(incident)
  for (const incident of lists.incidentHistory ?? []) add(incident)
  return [...byId.values()]
}

function systemName(system: HetznerSystem, fallbackId: string): string {
  return (system.titleEn ?? system.titleDe ?? "").trim() || fallbackId
}

/**
 * Pull `__NEXT_DATA__.props.pageProps` out of the official status HTML.
 */
export function parseHetznerNextData(html: string): HetznerPage {
  const match = html.match(NEXT_DATA_RE)
  if (!match?.[1]) {
    throw new Error("Hetzner status HTML had no __NEXT_DATA__ payload")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(match[1])
  } catch {
    throw new Error("Hetzner __NEXT_DATA__ was not valid JSON")
  }
  const pageProps = (parsed as { props?: { pageProps?: unknown } })?.props?.pageProps
  if (!pageProps || typeof pageProps !== "object") {
    throw new Error("Hetzner __NEXT_DATA__ was missing pageProps")
  }
  const record = pageProps as {
    systems?: HetznerSystem[] | null
    incidents?: HetznerIncidents | null
  }
  if (!record.incidents || typeof record.incidents !== "object") {
    throw new Error("Hetzner __NEXT_DATA__ was missing incidents")
  }
  return {
    systems: Array.isArray(record.systems) ? record.systems : [],
    incidents: record.incidents,
  }
}

/**
 * Map a parsed Hetzner page into our normalized service state.
 */
export function mapHetzner(
  page: HetznerPage,
  options: MapHetznerOptions = {},
): MappedServiceState {
  const now = options.now ?? new Date()
  const systemsByRef = new Map<string, HetznerSystem>()
  for (const system of page.systems) {
    if (system.id == null) continue
    systemsByRef.set(`/systems/${system.id}`, system)
  }

  const incidents = collectIncidents(page.incidents).slice(
    0,
    options.maxIncidents ?? 25,
  )

  let status: ServiceStatus = "operational"
  const affected = new Map<string, ServiceStatus>()
  for (const incident of incidents) {
    const mapped = rollupStatus(incident, now)
    if (mapped !== "operational") {
      status = worst(status, mapped)
    }
    if (paintsCard(incident, now) && incident.system) {
      const current = affected.get(incident.system) ?? "operational"
      affected.set(incident.system, worst(current, mapped))
    }
  }

  const components: MappedComponent[] = [...affected.entries()].map(
    ([ref, componentStatus], index) => {
      const system = systemsByRef.get(ref)
      return {
        externalId: ref,
        name: system ? systemName(system, ref) : ref,
        status: componentStatus,
        position: index,
      }
    },
  )

  const mappedIncidents: MappedIncident[] = incidents.map((incident) => {
    const resolved = isResolved(incident, now)
    const activeMaintenance = isHetznerActiveMaintenance(incident, now)
    const type = incidentType(incident)
    return {
      externalId: String(incident.id),
      title: incidentTitle(incident) as string,
      status: resolved
        ? "resolved"
        : activeMaintenance
          ? "in_progress"
          : incidentState(incident) || "unknown",
      impact: isInformational(incident)
        ? "informational"
        : type || null,
      url: HETZNER_STATUS_PAGE,
      startedAt: toIso(incident.startTime ?? incident.createdAt),
      resolvedAt: resolved ? toIso(incident.endTime ?? incident.updatedAt) : null,
    }
  })

  const headline = incidents.find((incident) => paintsCard(incident, now))

  return {
    status,
    incidentTitle: headline ? incidentTitle(headline) : null,
    detail: {
      source: "hetzner",
      openOutageCount: incidents.filter((incident) => isHetznerOpenOutage(incident, now)).length,
      activeMaintenanceCount: incidents.filter((incident) =>
        isHetznerActiveMaintenance(incident, now),
      ).length,
    },
    components,
    incidents: mappedIncidents,
  }
}

function htmlUserAgent(configured: string): string {
  return configured.toLowerCase().startsWith("mozilla/") ? configured : HETZNER_BROWSER_UA
}

/**
 * Fetch and map live Hetzner state from the official status HTML.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchHetznerState(
  options: HetznerFetchOptions,
): Promise<MappedServiceState> {
  const fetchImpl = options.fetchImpl ?? fetch
  const res = await fetchImpl(HETZNER_STATUS_PAGE, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": htmlUserAgent(options.userAgent),
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${HETZNER_STATUS_PAGE} -> HTTP ${res.status}`)
  }
  const html = await res.text()
  return mapHetzner(parseHetznerNextData(html), { maxIncidents: options.maxIncidents })
}
