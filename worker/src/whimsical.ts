/**
 * Whimsical / SorryApp HTML mapper (SMA-68, Design).
 *
 * status.whimsical.com is a SorryApp page with no public JSON (the
 * `/api/v1` routes 406). The HTML embeds `#component-grid-data` and a
 * page-level `text-state-*` class plus headline. Do not call a SorryApp
 * REST API from here — Postmark's JSON path is a different ticket.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const WHIMSICAL_STATUS_PAGE = "https://status.whimsical.com"

export const WHIMSICAL_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

const COMPONENT_GRID_RE =
  /<script[^>]*\bid=["']component-grid-data["'][^>]*>([\s\S]*?)<\/script>/i
const HEADLINE_RE = /<h1\b[^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/i
const STATE_CLASS_RE = /text-state-([a-z0-9-]+)/i

export type SorryAppComponent = {
  id?: number | string
  name?: string
  state?: string | null
  state_text?: string | null
  parent_id?: number | string | null
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

export function mapSorryAppState(state: string | null | undefined): ServiceStatus {
  switch ((state ?? "").toLowerCase().replace(/[_\s]+/g, "-")) {
    case "operational":
    case "ok":
      return "operational"
    case "degraded":
    case "degraded-performance":
      return "degraded"
    case "partial":
    case "partial-outage":
      return "partial_outage"
    case "outage":
    case "major":
    case "major-outage":
      return "major_outage"
    case "maintenance":
    case "under-maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function extractSorryAppHeadline(html: string): string | null {
  const match = html.match(HEADLINE_RE)
  if (!match) return null
  const text = stripTags(match[1])
  return text.length > 0 ? text : null
}

export function extractSorryAppPageState(html: string): ServiceStatus {
  const cls = html.match(STATE_CLASS_RE)?.[1]
  if (cls) {
    const mapped = mapSorryAppState(cls)
    if (mapped !== "unknown") return mapped
  }
  const headline = (extractSorryAppHeadline(html) ?? "").toLowerCase()
  if (!headline) return "unknown"
  if (/all systems are go|all systems operational|looking good/.test(headline)) {
    return "operational"
  }
  if (/maintenance/.test(headline)) return "maintenance"
  if (/major|outage|down/.test(headline)) return "major_outage"
  if (/experiencing|degraded|issues|wobbly|disruption/.test(headline)) {
    return "degraded"
  }
  return "unknown"
}

export function extractSorryAppComponents(html: string): SorryAppComponent[] {
  const match = html.match(COMPONENT_GRID_RE)
  if (!match) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(match[1])
  } catch {
    throw new Error("SorryApp component-grid-data is not valid JSON")
  }
  if (!Array.isArray(parsed)) {
    throw new Error("SorryApp component-grid-data is not an array")
  }
  return parsed.filter((row): row is SorryAppComponent => {
    return row != null && typeof row === "object"
  })
}

export type MapWhimsicalOptions = {
  pageUrl?: string
}

/**
 * Map SorryApp HTML (headline + embedded component grid) into our shape.
 * Throws when the page has neither a recognizable state nor components
 * so a Cloudflare/empty response marks the snapshot stale.
 */
export function mapWhimsicalHtml(
  html: string,
  options: MapWhimsicalOptions = {},
): MappedServiceState {
  const pageUrl = (options.pageUrl ?? WHIMSICAL_STATUS_PAGE).replace(/\/+$/, "")
  const componentsRaw = extractSorryAppComponents(html)
  const components: MappedComponent[] = componentsRaw
    .filter((row) => row.id != null && row.name)
    .map((row, index) => ({
      externalId: String(row.id),
      name: row.name as string,
      status: mapSorryAppState(row.state),
      position: index,
    }))

  let status = extractSorryAppPageState(html)
  for (const component of components) {
    if (component.status === "unknown") continue
    status = worst(status, component.status)
  }
  if (status === "unknown" && components.length === 0) {
    throw new Error("SorryApp HTML had no page state and no components")
  }
  if (status === "unknown") status = "operational"

  const headline = extractSorryAppHeadline(html)
  const incidents: MappedIncident[] = []
  if (status !== "operational" && headline) {
    incidents.push({
      externalId: "whimsical-page",
      title: headline,
      status: status === "maintenance" ? "in_progress" : "investigating",
      impact: status,
      url: pageUrl,
      startedAt: null,
      resolvedAt: null,
    })
  }

  return {
    status,
    incidentTitle: incidents[0]?.title ?? null,
    detail: {
      source: "sorryapp_html",
      headline,
      pageState: extractSorryAppPageState(html),
    },
    components,
    incidents,
  }
}

function htmlUserAgent(configured: string): string {
  return configured.toLowerCase().startsWith("mozilla/") ? configured : WHIMSICAL_BROWSER_UA
}

/**
 * Fetch status.whimsical.com HTML and map it.
 * Throws on network error, timeout, non-2xx, or unparseable HTML.
 */
export async function fetchWhimsicalState(options: FetchOptions): Promise<MappedServiceState> {
  const root = WHIMSICAL_STATUS_PAGE.replace(/\/+$/, "")
  const headers = {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": htmlUserAgent(options.userAgent),
  }
  const get = () =>
    fetch(root + "/", {
      headers,
      signal: AbortSignal.timeout(options.timeoutMs),
      redirect: "follow",
    })
  // SorryApp occasionally 406s the first HTML GET; one retry is enough.
  let res = await get()
  if (res.status === 406) res = await get()
  if (!res.ok) {
    throw new Error(`GET ${root}/ -> HTTP ${res.status}`)
  }
  const html = await res.text()
  return mapWhimsicalHtml(html, { pageUrl: root })
}
