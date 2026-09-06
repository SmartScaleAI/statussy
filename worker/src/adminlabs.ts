/**
 * Admin Labs HTML mapper (SMA-70: Document360, SMA-72: Eppo).
 *
 * status.document360.com is Admin Labs, not Statuspage — `/api/v2`
 * redirects to a “status page disabled” HTML page. The public HTML is
 * the live source: overall-status, EU/US/Canada `block-item-sub`
 * monitors, and `/status/incident/id/` history. No public JSON/RSS.
 *
 * status.eppo.cloud is the same host family but often overall-only
 * (“All systems operational”) with no component tiles. `/index.json`
 * and `/api/v2` fall through to the AdminLabs not-found page.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

const CLOSED_LABELS = new Set(["resolved", "completed", "postmortem"])

export function mapAdminLabsClass(value: string | undefined | null): ServiceStatus {
  switch ((value ?? "").trim().toLowerCase()) {
    case "ok":
    case "operational":
    case "notice":
    case "info":
    case "informational":
      return "operational"
    case "warning":
    case "degraded":
    case "minor":
      return "degraded"
    case "partial":
      return "partial_outage"
    case "error":
    case "critical":
    case "outage":
    case "down":
      return "major_outage"
    case "maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

/** SMA-72 alias used by the Eppo call path / tests. */
export const mapAdminlabsTone = mapAdminLabsClass

export function mapAdminLabsLabel(label: string | undefined | null): ServiceStatus {
  const normalized = (label ?? "").trim().toLowerCase()
  if (normalized === "operational" || normalized === "all systems operational") {
    return "operational"
  }
  if (normalized === "degraded" || normalized === "degraded performance") return "degraded"
  if (normalized === "partial outage") return "partial_outage"
  if (normalized === "major outage" || normalized === "down") return "major_outage"
  if (normalized === "maintenance" || normalized === "under maintenance") return "maintenance"
  return mapAdminLabsClass(normalized)
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function fallbackComponentId(html: string, start: number, name: string): string {
  const before = html.slice(Math.max(0, start - 4000), start)
  const child = [...before.matchAll(/id="child-([^"]+)"/g)].pop()?.[1]
  const group = [...before.matchAll(/<h3>\s*([^<]+?)\s*<\/h3>/g)].pop()?.[1]?.trim()
  const key = slug(name) || "component"
  if (child) return `${child}:${key}`
  if (group) return `${slug(group)}:${key}`
  return key
}

function parseAdminLabsTime(stamp: string | undefined): string | null {
  if (!stamp) return null
  const cleaned = stamp.replace(/\s*\|\s*/g, " ").replace(/GMT/, "").trim()
  const date = new Date(cleaned)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function readStatusTitle(slice: string): { className?: string; label?: string } {
  const heading = slice.match(
    /<(?:h4|span) class="status-title\s+([^"]+)"[^>]*>\s*([^<]+?)\s*<\/(?:h4|span)>/i,
  )
  if (heading) return { className: heading[1], label: heading[2] }
  return {
    className: slice.match(/status-title\s+([a-z]+)/i)?.[1],
    label: undefined,
  }
}

function pushComponent(
  components: MappedComponent[],
  seen: Set<string>,
  id: string,
  name: string,
  className: string | undefined,
  label: string | undefined,
): void {
  if (seen.has(id)) return
  seen.add(id)
  const fromLabel = mapAdminLabsLabel(label)
  components.push({
    externalId: id,
    name,
    status: fromLabel === "unknown" ? mapAdminLabsClass(className) : fromLabel,
    position: components.length,
  })
}

/** Leaf monitors only — region headers (`block-item-has-block-item-sub`) stay out of Health %. */
export function parseAdminLabsComponents(html: string): MappedComponent[] {
  const components: MappedComponent[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/<div class="block-item-sub[^"]*"/gi)) {
    const start = match.index ?? 0
    const slice = html.slice(start, start + 2500)
    const name = stripTags(slice.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] ?? "").replace(/\s*\?$/, "")
    if (!name) continue
    const id =
      slice.match(/data-tooltip-content="#component_([^"]+)"/i)?.[1] ??
      fallbackComponentId(html, start, name)
    const { className, label } = readStatusTitle(slice)
    pushComponent(components, seen, id, name, className, label)
  }
  if (components.length > 0) return components

  // Eppo-style pages expose top-level `block-item` tiles, not `block-item-sub`.
  for (const match of html.matchAll(/<div class="block-item(?![^"]*has-block-item-sub)[^"]*"/gi)) {
    const start = match.index ?? 0
    const slice = html.slice(start, start + 2500)
    const name = stripTags(slice.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] ?? "").replace(/\s*\?$/, "")
    if (!name) continue
    const id =
      slice.match(/data-tooltip-content="#component_([^"]+)"/i)?.[1] ??
      fallbackComponentId(html, start, name)
    const { className, label } = readStatusTitle(slice)
    pushComponent(components, seen, id, name, className, label)
  }
  return components
}

export function parseAdminLabsIncidents(html: string, pageUrl: string): MappedIncident[] {
  const root = pageUrl.replace(/\/+$/, "")
  const incidents: MappedIncident[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(
    /<h([35])[^>]*>\s*([^<]+?)\s*<a href="(\/status\/incident\/id\/([^"]+))"/gi,
  )) {
    const id = match[4]
    if (!id || seen.has(id)) continue
    seen.add(id)
    const title = stripTags(match[2])
    if (!title) continue
    const after = html.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 800)
    const time = after.match(/<p class="update-time"><b>([^<]+)<\/b>\s*\|\s*([^<]+)<\/p>/i)
    const label = (time?.[1] ?? "investigating").trim()
    const closed = CLOSED_LABELS.has(label.toLowerCase())
    const at = parseAdminLabsTime(time?.[2])
    incidents.push({
      externalId: id,
      title,
      status: closed ? "resolved" : label.toLowerCase(),
      impact: null,
      url: `${root}${match[3]}`,
      startedAt: closed ? null : at,
      resolvedAt: closed ? at : null,
    })
  }

  return incidents
}

export function parseAdminLabsOverall(html: string): { status: ServiceStatus; headline: string | null } {
  const block = html.match(/class="overall-status\s+([^"]+)"[^>]*>\s*<h1>([^<]+)<\/h1>/i)
  if (!block) return { status: "unknown", headline: null }
  return {
    status: mapAdminLabsClass(block[1]),
    headline: stripTags(block[2]) || null,
  }
}

/** SMA-72 alias: `{ tone, title }` for the Eppo overall-only fixture. */
export function parseAdminlabsOverall(html: string): { tone: string; title: string } | null {
  const match = html.match(/class="overall-status\s+([a-z]+)"[^>]*>\s*<h1>([\s\S]*?)<\/h1>/i)
  if (!match) return null
  return { tone: match[1], title: stripTags(match[2]) }
}

/** Map an Admin Labs HTML status page into our normalized shape. */
export function mapAdminLabsHtml(html: string, pageUrl: string, maxIncidents = 25): MappedServiceState {
  const components = parseAdminLabsComponents(html)
  const overall = parseAdminLabsOverall(html)
  if (components.length === 0 && overall.status === "unknown" && !overall.headline) {
    throw new Error(`Admin Labs HTML from ${pageUrl} had no overall-status block or component tiles`)
  }
  const incidents = parseAdminLabsIncidents(html, pageUrl).slice(0, maxIncidents)
  const open = incidents.find((incident) => incident.resolvedAt == null)
  const status = worstStatus([
    overall.status === "unknown" ? "operational" : overall.status,
    worstStatus(components.map((component) => component.status)),
  ])

  return {
    status,
    incidentTitle: status === "operational" ? null : (open?.title ?? null),
    detail: {
      source: "admin_labs",
      pageUrl,
      headline: overall.headline,
    },
    components,
    incidents,
  }
}

/** SMA-72 alias used by Eppo tests. */
export const mapAdminlabsHtml = mapAdminLabsHtml

/**
 * Fetch and map an Admin Labs HTML status page.
 * Throws on network error, timeout, non-2xx, or unparseable HTML.
 */
export async function fetchAdminLabsState(
  pageUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = pageUrl.replace(/\/+$/, "")
  const res = await fetch(root, {
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "user-agent": options.userAgent,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${root} -> HTTP ${res.status}`)
  }
  const html = await res.text()
  return mapAdminLabsHtml(html, root, options.maxIncidents)
}

/** SMA-72 alias used by the Eppo job. */
export const fetchAdminlabsState = fetchAdminLabsState
