/**
 * StatusCast HTML mapper (SMA-63: Fastly).
 *
 * www.fastlystatus.com is a StatusCast page. There is no public Statuspage
 * JSON; `/status.json` and the HTML both 403 the worker UA. A browser-like
 * UA gets the HTML (hero rollup + current incident rows).
 *
 * Informational notices and future scheduled maintenance stay in the
 * incident list but do not paint the card (same call as Hetzner / GCP).
 * The history-grid calendar is not a component board — Health stays 1/1.
 */

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
