/**
 * StatusCast mappers (SMA-63: Fastly HTML; SMA-71: Campaign Monitor RSS).
 *
 * Fastly: www.fastlystatus.com has no public Statuspage JSON; `/status.json`
 * and the HTML 403 the worker UA. A browser-like UA gets the HTML (hero
 * rollup + current incident rows). Informational notices and future
 * scheduled maintenance stay in the diary but do not paint the card.
 *
 * Campaign Monitor: HTML and `/api/v2` 403. The public surface is `/rss`
 * (titled "Marigold rss feed"). Each incident is many items (one per
 * update). We group by incident id and take the newest update. Name stays
 * Campaign Monitor. Neither page exposes a component board — Health 1/1.
 */

import {
  classifyOpenIncident,
  parseFeed,
  type RssFeedMeta,
  type RssItem,
} from "./rss.js"
import type {
  FetchOptions,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export const STATUSCAST_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

export type StatuscastIncident = {
  id: string
  title: string
  href: string
  type: string
  lifecycle: string
  severity: string
  startedAt: string | null
}

const INCIDENT_BODY =
  /class="[^"]*incident-body[^"]*incident-type-([a-z]+)[^"]*incident-status-([a-z]+)[^"]*incident-mostsevere-status-([a-z]+)[^"]*"/gi

/** Map the StatusCast hero / status.json label to our enum. */
export function mapStatuscastLabel(label: string | undefined | null): ServiceStatus {
  const normalized = (label ?? "").replace(/\s+/g, " ").trim().toLowerCase()
  if (
    normalized === "" ||
    normalized === "operational" ||
    normalized === "normal" ||
    normalized === "all systems operational"
  ) {
    return "operational"
  }
  if (normalized === "informational" || normalized === "information" || normalized === "info") {
    return "operational"
  }
  if (normalized.includes("maintenance")) return "maintenance"
  if (normalized.includes("degraded")) return "degraded"
  if (
    normalized.includes("partial") ||
    normalized.includes("disruption") ||
    normalized.includes("service impact")
  ) {
    return "partial_outage"
  }
  if (
    normalized.includes("unavailable") ||
    normalized.includes("major outage") ||
    normalized.includes("outage") ||
    normalized === "down"
  ) {
    return "major_outage"
  }
  return "unknown"
}

export function parseStatuscastHero(html: string): string | null {
  const title = html.match(/<h1[^>]*class="[^"]*sc-hero__title[^"]*"[^>]*>([^<]+)<\/h1>/i)?.[1]
  if (title?.trim()) return title.trim()
  const label = html.match(
    /<div[^>]*class="[^"]*sc-hero__status-label[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i,
  )?.[1]
  return label?.trim() || null
}

function parseIncidentDate(raw: string | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, " ").trim()
  const date = new Date(cleaned)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Parse current StatusCast incident rows from the page HTML.
 * History-grid cells (`component-available` in a calendar) are ignored.
 */
export function parseStatuscastIncidents(html: string): StatuscastIncident[] {
  const incidents: StatuscastIncident[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(INCIDENT_BODY)) {
    const type = match[1]
    const lifecycle = match[2]
    const severity = match[3]
    const start = match.index ?? 0
    const slice = html.slice(start, start + 4000)
    const href = slice.match(/href="(\/incident\/(\d+))"/i)
    const id = href?.[2]
    const title =
      slice.match(/aria-label="Incident Title">([^<]+)</i)?.[1]?.trim() ??
      slice.match(/<h2[^>]*class="[^"]*incident-title[^"]*"[^>]*>([^<]+)<\/h2>/i)?.[1]?.trim()
    if (!id || !title || seen.has(id)) continue
    seen.add(id)
    const dateRaw = slice.match(/aria-label="Incident Date">\s*([^<]+)/i)?.[1]
    incidents.push({
      id,
      title,
      href: href?.[1] ?? `/incident/${id}`,
      type,
      lifecycle,
      severity,
      startedAt: parseIncidentDate(dateRaw),
    })
  }

  return incidents
}

/** Future / informational rows stay in the diary but do not paint the card. */
export function statuscastPaintsCard(incident: StatuscastIncident): boolean {
  if (incident.lifecycle === "future" || incident.lifecycle === "resolved") return false
  if (incident.severity === "informational") return false
  if (incident.type === "scheduledmaintenance" && incident.lifecycle !== "inprogress") {
    return false
  }
  return incident.lifecycle === "inprogress"
}

export function mapStatuscastIncidentStatus(incident: StatuscastIncident): string {
  if (incident.lifecycle === "resolved") return "resolved"
  if (incident.lifecycle === "future" || incident.type === "scheduledmaintenance") {
    return "scheduled"
  }
  return "investigating"
}

function mapStatuscastIncidentSeverity(incident: StatuscastIncident): ServiceStatus {
  if (incident.severity === "maintenance" || incident.type === "scheduledmaintenance") {
    return "maintenance"
  }
  if (incident.severity === "degraded") return "degraded"
  if (incident.severity === "unavailable" || incident.type === "serviceunavailable") {
    return "partial_outage"
  }
  return "degraded"
}

/** Map a StatusCast HTML status page into our normalized shape. */
export function mapStatuscastHtml(html: string, pageUrl: string): MappedServiceState {
  const hero = parseStatuscastHero(html)
  if (!hero) {
    throw new Error(`StatusCast HTML from ${pageUrl} had no hero status`)
  }

  const root = pageUrl.replace(/\/+$/, "")
  const parsed = parseStatuscastIncidents(html)
  const incidents: MappedIncident[] = parsed.map((incident) => ({
    externalId: incident.id,
    title: incident.title,
    status: mapStatuscastIncidentStatus(incident),
    impact: incident.severity,
    url: `${root}${incident.href}`,
    startedAt: incident.startedAt,
    resolvedAt: null,
  }))

  const painting = parsed.filter(statuscastPaintsCard)
  const fromIncidents = painting.map(mapStatuscastIncidentSeverity)
  const fromHero = mapStatuscastLabel(hero)
  const status = painting.length > 0 ? worstStatus([fromHero, ...fromIncidents]) : fromHero
  const headline = painting[0]?.title ?? null

  return {
    status: status === "unknown" ? "operational" : status,
    incidentTitle: headline,
    detail: {
      source: "statuscast",
      pageUrl: root,
      hero,
      openIncidents: painting.length,
    },
    components: [],
    incidents,
  }
}

export type StatuscastFetchOptions = FetchOptions & {
  fetchImpl?: typeof fetch
}

function htmlUserAgent(configured: string): string {
  return configured.toLowerCase().startsWith("mozilla/") ? configured : STATUSCAST_BROWSER_UA
}

/**
 * Fetch and map a StatusCast HTML status page.
 * Throws on network error, timeout, non-2xx (incl. worker-UA 403), or
 * HTML with no hero rollup.
 */
export async function fetchStatuscastState(
  pageUrl: string,
  options: StatuscastFetchOptions,
): Promise<MappedServiceState> {
  const root = pageUrl.replace(/\/+$/, "")
  const fetchImpl = options.fetchImpl ?? fetch
  const res = await fetchImpl(root, {
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "user-agent": htmlUserAgent(options.userAgent),
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${root} -> HTTP ${res.status}`)
  }
  const html = await res.text()
  const state = mapStatuscastHtml(html, root)
  return {
    ...state,
    incidents: state.incidents.slice(0, options.maxIncidents ?? 25),
  }
}

// ---------------------------------------------------------------------------
// Campaign Monitor RSS (SMA-71). HTML + /api/v2 403; /rss is the public surface.
// ---------------------------------------------------------------------------

const CLOSED_STATUSES = new Set(["resolved", "completed", "postmortem"])

const STILL_OPEN_RE =
  /\b(continuing to monitor|we(?:'re| are) (?:aware|currently investigating|working to)|unfortunately continues|awaiting (?:their|a) response|will share an update|currently investigating|working to (?:identify|resolve)|proportion of .+ not being delivered)\b/i

const RESOLVED_RE =
  /\b(has (?:now )?been resolved|now been resolved|is now (?:fully )?resolved|now working normally|now operating as normal|completed (?:our )?scheduled maintenance|can now login without any issues|no longer experience|issue has been resolved|incident has now been resolved)\b/i

const MONITORING_RE = /\bverifying that (?:everything|all functionality) is working\b/i

/** Incident id from `/incident/706835` or guid `/706835/1601159`. */
export function statusCastIncidentId(item: RssItem): string | null {
  const fromLink = item.link?.match(/\/incident\/(\d+)/i)?.[1]
  if (fromLink) return fromLink
  const fromGuid = item.externalId?.match(/(?:^|\/)(\d+)(?:\/|$)/)?.[1]
  return fromGuid ?? item.externalId
}

/**
 * StatusCast items have no `Status:` line. Infer lifecycle from the
 * newest update body so historical resolved posts do not stay open.
 */
export function extractStatusCastStatus(item: RssItem): string {
  const haystack = `${item.title}\n${item.text}`
  if (STILL_OPEN_RE.test(haystack)) return "investigating"
  if (RESOLVED_RE.test(haystack)) return "resolved"
  if (MONITORING_RE.test(haystack)) return "monitoring"
  return "investigating"
}

type IncidentGroup = {
  newest: RssItem
  startedAt: string | null
}

function toIso(raw: string | null): string | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function groupIncidents(items: RssItem[]): IncidentGroup[] {
  const groups = new Map<string, IncidentGroup>()
  const order: string[] = []

  for (const item of items) {
    const id = statusCastIncidentId(item)
    if (!id) continue
    const published = toIso(item.publishedAt)
    const existing = groups.get(id)
    if (!existing) {
      groups.set(id, { newest: item, startedAt: published })
      order.push(id)
      continue
    }
    if (published && (!existing.startedAt || published < existing.startedAt)) {
      existing.startedAt = published
    }
  }

  return order.map((id) => groups.get(id)!).filter(Boolean)
}

/**
 * Map a StatusCast RSS feed into our normalized shape. One row per
 * incident (not per update). No component grid.
 */
export function mapStatusCastFeed(
  items: RssItem[],
  meta: RssFeedMeta,
  maxIncidents = 25,
): MappedServiceState {
  const incidents: MappedIncident[] = []
  const openSeverities: ServiceStatus[] = []
  let headline: string | null = null

  for (const group of groupIncidents(items).slice(0, maxIncidents)) {
    const item = group.newest
    const externalId = statusCastIncidentId(item)
    if (!externalId) continue
    const status = extractStatusCastStatus(item)
    const open = !CLOSED_STATUSES.has(status)
    if (open) {
      openSeverities.push(classifyOpenIncident(item))
      headline ??= item.title
    }
    incidents.push({
      externalId,
      title: item.title,
      status,
      impact: null,
      url: item.link,
      startedAt: group.startedAt,
      resolvedAt: open ? null : toIso(item.publishedAt),
    })
  }

  return {
    status: worstStatus(openSeverities),
    incidentTitle: headline,
    detail: {
      source: "statuscast",
      feedUrl: meta.feedUrl,
      feedTitle: meta.feedTitle,
      lastBuildDate: meta.lastBuildDate,
      openIncidents: openSeverities.length,
    },
    components: [],
    incidents,
  }
}

export type StatusCastRssFetchOptions = {
  timeoutMs: number
  userAgent: string
  maxIncidents?: number
}

async function fetchText(url: string, options: StatusCastRssFetchOptions): Promise<string> {
  const res = await fetch(url, {
    headers: {
      accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
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

function feedTitle(xml: string): string | null {
  const head = xml.replace(/<(item|entry)[\s>][\s\S]*/i, "")
  return head.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null
}

function feedLastBuild(xml: string): string | null {
  const head = xml.replace(/<(item|entry)[\s>][\s\S]*/i, "")
  return (
    head.match(/<lastBuildDate(?:\s[^>]*)?>([\s\S]*?)<\/lastBuildDate>/i)?.[1]?.trim() ??
    head.match(/<updated(?:\s[^>]*)?>([\s\S]*?)<\/updated>/i)?.[1]?.trim() ??
    null
  )
}

/**
 * Fetch and map a StatusCast RSS feed. `feedUrls` are tried in order;
 * the first one that fetches and parses wins.
 */
export async function fetchStatusCastState(
  feedUrls: readonly string[],
  options: StatusCastRssFetchOptions,
): Promise<MappedServiceState> {
  let lastError: Error | null = null
  for (const feedUrl of feedUrls) {
    try {
      const xml = await fetchText(feedUrl, options)
      const items = parseFeed(xml)
      return mapStatusCastFeed(
        items,
        {
          feedUrl,
          feedTitle: feedTitle(xml),
          lastBuildDate: feedLastBuild(xml),
        },
        options.maxIncidents,
      )
    } catch (err) {
      lastError = err as Error
      console.warn(`[statuscast] feed failed ${feedUrl}: ${lastError.message}`)
    }
  }
  throw lastError ?? new Error("no StatusCast feed URLs configured")
}
