/**
 * Redis Firehydrant/Nunc fetcher (SMA-67 / SMA-51).
 *
 * status.redis.io is a Nunc SPA. Live JSON is `/data/payload.json`
 * (overall from `operationalMessage` + open incidents, plus 7 named
 * services). Components have no live status field — Health stays 7/7
 * unless an open incident lists `componentConditions`.
 *
 * `/data/rss.xml` is the fallback when the JSON payload is unreachable.
 */

import {
  classifyOpenIncident,
  parseFeed,
  type RssItem,
} from "./rss.js"
import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const REDIS_STATUS_PAGE = "https://status.redis.io"
export const REDIS_PAYLOAD_URL = `${REDIS_STATUS_PAGE}/data/payload.json`
export const REDIS_RSS_URL = `${REDIS_STATUS_PAGE}/data/rss.xml`

export type RedisComponent = {
  id?: string
  name?: string
  condition?: string
}

export type RedisTimestamps = {
  started?: string | null
  detected?: string | null
  resolved?: string | null
  acknowledged?: string | null
}

export type RedisIncident = {
  id?: string
  title?: string
  timestamps?: RedisTimestamps | null
  severitySlug?: string | null
  componentConditions?: Record<string, string> | null
  components?: RedisComponent[] | null
}

export type RedisPayload = {
  config?: {
    title?: string
    operationalMessage?: string | null
    companyName?: string
  } | null
  components?: RedisComponent[] | null
  incidents?: RedisIncident[] | null
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

const CLOSED_STATUSES = new Set(["resolved", "completed", "postmortem", "closed"])

const NO_ACTIVE_RE = /no active incidents/i

export function mapRedisCondition(condition: string | undefined | null): ServiceStatus {
  switch ((condition ?? "").trim().toLowerCase()) {
    case "operational":
      return "operational"
    case "degraded":
    case "degraded_performance":
      return "degraded"
    case "unavailable":
    case "offline":
    case "major_outage":
    case "outage":
      return "major_outage"
    case "partial_outage":
      return "partial_outage"
    case "maintenance":
    case "under_maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

export function mapRedisSeveritySlug(slug: string | undefined | null): ServiceStatus {
  switch ((slug ?? "").trim().toLowerCase()) {
    case "maintenance":
      return "maintenance"
    case "degraded":
    case "minor":
    case "sev3":
    case "sev-3":
      return "degraded"
    case "major":
    case "sev2":
    case "sev-2":
      return "partial_outage"
    case "critical":
    case "unavailable":
    case "sev1":
    case "sev-1":
      return "major_outage"
    case "unset":
    case "":
      return "unknown"
    default:
      return mapRedisCondition(slug)
  }
}

export function isRedisIncidentOpen(incident: RedisIncident): boolean {
  return !incident.timestamps?.resolved
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function incidentUrl(id: string): string {
  return `${REDIS_STATUS_PAGE}/incidents/${id}`
}

function classifyRedisIncident(incident: RedisIncident): ServiceStatus {
  let status = mapRedisSeveritySlug(incident.severitySlug)
  for (const condition of Object.values(incident.componentConditions ?? {})) {
    const mapped = mapRedisCondition(condition)
    status = worst(status, mapped === "unknown" ? "degraded" : mapped)
  }
  for (const component of incident.components ?? []) {
    const mapped = mapRedisCondition(component.condition)
    status = worst(status, mapped === "unknown" ? "operational" : mapped)
  }
  if (status === "unknown" || status === "operational") {
    const fromTitle = classifyOpenIncident({
      externalId: incident.id ?? null,
      title: incident.title ?? "",
      link: null,
      publishedAt: null,
      text: "",
      categories: [],
    })
    return fromTitle
  }
  return status
}

export type MapRedisOptions = {
  maxIncidents?: number
}

/**
 * Map Firehydrant/Nunc payload.json. Overall status comes from open
 * incidents (and their component conditions). A clean
 * `operationalMessage` with no open incidents is operational. The 7
 * named services default to operational — Nunc does not publish a
 * live status field on components.
 */
export function mapRedis(
  payload: RedisPayload,
  options: MapRedisOptions = {},
): MappedServiceState {
  const openIncidents = (payload.incidents ?? []).filter(
    (incident) => incident.id && incident.title && isRedisIncidentOpen(incident),
  )

  const affected = new Map<string, ServiceStatus>()
  let status: ServiceStatus = "operational"
  for (const incident of openIncidents) {
    const mapped = classifyRedisIncident(incident)
    status = worst(status, mapped)
    const conditions = incident.componentConditions ?? {}
    for (const [name, condition] of Object.entries(conditions)) {
      const painted = mapRedisCondition(condition)
      affected.set(name, worst(affected.get(name) ?? "operational", painted === "unknown" ? "degraded" : painted))
    }
    for (const component of incident.components ?? []) {
      if (!component.name) continue
      const painted = mapRedisCondition(component.condition)
      affected.set(
        component.name,
        worst(affected.get(component.name) ?? "operational", painted === "unknown" ? "degraded" : painted),
      )
    }
  }

  const operationalMessage = payload.config?.operationalMessage?.trim() ?? ""
  if (openIncidents.length === 0 && operationalMessage && !NO_ACTIVE_RE.test(operationalMessage)) {
    status = worst(status, "degraded")
  }

  const components: MappedComponent[] = (payload.components ?? [])
    .filter((component) => component.id && component.name)
    .map((component, index) => ({
      externalId: component.id as string,
      name: component.name as string,
      status: affected.get(component.name as string) ?? "operational",
      position: index,
    }))

  const incidents = [...(payload.incidents ?? [])]
    .filter((incident) => incident.id && incident.title)
    .sort((a, b) => {
      const aStarted = Date.parse(a.timestamps?.started ?? "") || 0
      const bStarted = Date.parse(b.timestamps?.started ?? "") || 0
      return bStarted - aStarted
    })
    .slice(0, options.maxIncidents ?? 25)

  const mappedIncidents: MappedIncident[] = incidents.map((incident) => {
    const open = isRedisIncidentOpen(incident)
    return {
      externalId: incident.id as string,
      title: incident.title as string,
      status: open ? "investigating" : "resolved",
      impact: incident.severitySlug && incident.severitySlug !== "UNSET"
        ? incident.severitySlug.toLowerCase()
        : null,
      url: incidentUrl(incident.id as string),
      startedAt: toIso(incident.timestamps?.started ?? incident.timestamps?.detected),
      resolvedAt: open ? null : toIso(incident.timestamps?.resolved),
    }
  })

  const openTitle = openIncidents[0]?.title ?? null
  const messageTitle =
    openIncidents.length === 0 && operationalMessage && !NO_ACTIVE_RE.test(operationalMessage)
      ? operationalMessage
      : null

  return {
    status,
    incidentTitle: openTitle ?? messageTitle,
    detail: {
      source: "nunc",
      pageTitle: payload.config?.title ?? payload.config?.companyName ?? null,
      operationalMessage: operationalMessage || null,
      openIncidentCount: openIncidents.length,
    },
    components,
    incidents: mappedIncidents,
  }
}

const INCIDENT_TITLE_RE =
  /(?:New incident:\s*|Update for incident\s*|Note on incident\s*)["“](.+?)["”]/i
const MILESTONE_RE = /Milestone is now\s+'([a-z_ -]+)'/i
const INCIDENT_ID_RE = /\/incidents\/([0-9a-f-]{8,})/i

function redisRssTitle(item: RssItem): string {
  return item.title.match(INCIDENT_TITLE_RE)?.[1]?.trim() || item.title
}

function redisRssIncidentId(item: RssItem): string | null {
  const fromLink = item.link?.match(INCIDENT_ID_RE)?.[1]
  if (fromLink) return fromLink
  return item.externalId
}

function redisRssLifecycle(item: RssItem): string {
  const milestone = item.text.match(MILESTONE_RE)?.[1]?.trim().toLowerCase()
  if (milestone) {
    if (milestone === "closed") return "resolved"
    return milestone.replace(/\s+/g, "_")
  }
  if (/^New incident:/i.test(item.title)) return "investigating"
  return "investigating"
}

/**
 * Collapse Redis RSS updates (many items per incident) into one row
 * per incident id, using the newest milestone.
 */
export function mapRedisRss(
  items: RssItem[],
  options: MapRedisOptions = {},
): MappedServiceState {
  const byId = new Map<string, { item: RssItem; status: string; title: string }>()
  for (const item of items) {
    const id = redisRssIncidentId(item)
    if (!id) continue
    if (byId.has(id)) continue
    byId.set(id, {
      item,
      status: redisRssLifecycle(item),
      title: redisRssTitle(item),
    })
  }

  const grouped = [...byId.entries()].slice(0, options.maxIncidents ?? 25)
  const mappedIncidents: MappedIncident[] = grouped.map(([id, row]) => {
    const open = !CLOSED_STATUSES.has(row.status)
    return {
      externalId: id,
      title: row.title,
      status: row.status,
      impact: null,
      url: row.item.link ?? incidentUrl(id),
      startedAt: toIso(row.item.publishedAt),
      resolvedAt: open ? null : toIso(row.item.publishedAt),
    }
  })

  const open = grouped.filter(([, row]) => !CLOSED_STATUSES.has(row.status))
  let status: ServiceStatus = "operational"
  for (const [, row] of open) {
    status = worst(status, classifyOpenIncident(row.item))
  }

  return {
    status,
    incidentTitle: open[0]?.[1].title ?? null,
    detail: {
      source: "nunc-rss",
      feedUrl: REDIS_RSS_URL,
      openIncidentCount: open.length,
    },
    components: [],
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

async function fetchText(url: string, options: FetchOptions): Promise<string> {
  const res = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "user-agent": options.userAgent,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  return await res.text()
}

function isRedisPayload(payload: RedisPayload): boolean {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (Array.isArray(payload.components) || Array.isArray(payload.incidents)),
  )
}

/**
 * Fetch and map live Redis state from payload.json, falling back to
 * `/data/rss.xml` when the JSON fetch or parse fails.
 */
export async function fetchRedisState(options: FetchOptions): Promise<MappedServiceState> {
  try {
    const payload = await fetchJson<RedisPayload>(REDIS_PAYLOAD_URL, options)
    if (!isRedisPayload(payload)) {
      throw new Error(`Unexpected Redis status payload from ${REDIS_PAYLOAD_URL}`)
    }
    return mapRedis(payload, { maxIncidents: options.maxIncidents })
  } catch (err) {
    console.warn(`[redis] payload.json failed: ${(err as Error).message}; trying RSS`)
    const xml = await fetchText(REDIS_RSS_URL, options)
    return mapRedisRss(parseFeed(xml), { maxIncidents: options.maxIncidents })
  }
}
