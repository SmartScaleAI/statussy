/**
 * Statuspal HTML mapper (SMA-45: ChartMogul).
 *
 * Statuspal pages are live and useful in HTML but have no public JSON API
 * (custom-domain /api/v2 404s). The page embeds service tiles
 * (`#service-{id}` + status-type + name) and `window.incidents`.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export function mapStatuspalType(type: string | undefined | null): ServiceStatus {
  switch ((type ?? "").trim().toLowerCase()) {
    case "none":
    case "ok":
    case "operational":
      return "operational"
    case "minor":
      return "degraded"
    case "major":
      return "major_outage"
    case "scheduled":
    case "maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

export function mapStatuspalLabel(label: string | undefined | null): ServiceStatus {
  const normalized = (label ?? "").trim().toLowerCase()
  if (normalized === "operational") return "operational"
  if (normalized === "degraded" || normalized === "degraded performance") return "degraded"
  if (normalized === "partial outage") return "partial_outage"
  if (normalized === "major outage" || normalized === "down") return "major_outage"
  if (normalized === "maintenance" || normalized === "under maintenance") return "maintenance"
  return "unknown"
}

export type StatuspalEmbeddedIncident = {
  id?: number | string
  title?: string
  starts_at?: string | null
  ends_at?: string | null
  i_type?: { key?: string; title?: string; is_maintenance?: boolean } | null
}

const SERVICE_NAME = /<span class="service-status--name">([^<]+)<\/span>/i
const SERVICE_STATUS = /<span class="service-status--status">\s*([^<]+?)\s*<\/span>/i

export function parseStatuspalServices(html: string): MappedComponent[] {
  const components: MappedComponent[] = []
  const seen = new Set<string>()

  // Walk each service tile. The regex consumes up to the next service or
  // the incidents container so child tiles still match as their own blocks.
  const tiles = [
    ...html.matchAll(
      /<div id="service-(\d+)" class="service-status status-type-([^"\s]+)[^"]*"/gi,
    ),
  ]

  for (const match of tiles) {
    const id = match[1]
    const type = match[2]
    if (seen.has(id)) continue
    seen.add(id)
    const start = match.index ?? 0
    const slice = html.slice(start, start + 2500)
    const name = slice.match(SERVICE_NAME)?.[1]?.trim()
    if (!name) continue
    const label = slice.match(SERVICE_STATUS)?.[1]?.replace(/\s+/g, " ").trim()
    const fromLabel = mapStatuspalLabel(label)
    components.push({
      externalId: id,
      name,
      status: fromLabel === "unknown" ? mapStatuspalType(type) : fromLabel,
      position: components.length,
    })
  }

  return components
}

export function parseStatuspalIncidents(html: string, pageUrl: string): MappedIncident[] {
  const raw = html.match(/window\.incidents\s*=\s*(\[[\s\S]*?\]);/)
  if (!raw) return []
  let parsed: StatuspalEmbeddedIncident[]
  try {
    parsed = JSON.parse(raw[1]) as StatuspalEmbeddedIncident[]
  } catch {
    throw new Error("Statuspal window.incidents is not valid JSON")
  }
  if (!Array.isArray(parsed)) return []

  const root = pageUrl.replace(/\/+$/, "")
  const incidents: MappedIncident[] = []
  for (const item of parsed) {
    const title = (item.title ?? "").trim()
    if (!title || item.id == null) continue
    const typeKey = item.i_type?.key ?? (item.i_type?.is_maintenance ? "scheduled" : null)
    const ended = item.ends_at != null && item.ends_at !== ""
    incidents.push({
      externalId: String(item.id),
      title,
      status: ended ? "resolved" : typeKey === "scheduled" ? "in_progress" : "investigating",
      impact: typeKey ?? null,
      url: `${root}/incidents`,
      startedAt: toIso(item.starts_at),
      resolvedAt: ended ? toIso(item.ends_at) : null,
    })
  }
  return incidents
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Map a Statuspal HTML status page into our normalized shape. */
export function mapStatuspalHtml(html: string, pageUrl: string): MappedServiceState {
  const components = parseStatuspalServices(html)
  if (components.length === 0) {
    throw new Error(`Statuspal HTML from ${pageUrl} had no service tiles`)
  }
  const incidents = parseStatuspalIncidents(html, pageUrl)
  const open = incidents.find((incident) => incident.resolvedAt == null)
  const fromOpen = open ? mapStatuspalType(open.impact) : "operational"

  return {
    status: worstStatus([worstStatus(components.map((component) => component.status)), fromOpen]),
    incidentTitle: open?.title ?? null,
    detail: {
      source: "statuspal",
      pageUrl,
    },
    components,
    incidents,
  }
}

/**
 * Fetch and map a Statuspal HTML status page.
 * Throws on network error, timeout, non-2xx, or unparseable HTML.
 */
export async function fetchStatuspalState(
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
  return mapStatuspalHtml(html, root)
}
