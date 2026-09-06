/**
 * Uptime.com status-page mapper (SMA-70: Bump).
 *
 * status.bump.sh is an Uptime.com SPA. Do not use abandoned
 * bump.statuspage.io (stuck 2020 test incident). The public HTML
 * hydrates `StatusPageDisplayController` with the same JSON the
 * `/statuspage/{slug}/ajax` endpoint returns: components, active
 * incidents, and upcoming maintenance.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

const CLOSED_STATUSES = new Set(["resolved", "completed", "postmortem", "closed"])

export function mapUptimeComStatus(status: string | undefined | null): ServiceStatus {
  switch ((status ?? "").trim().toLowerCase().replaceAll("_", "-")) {
    case "operational":
    case "ok":
    case "notification":
      return "operational"
    case "degraded-performance":
    case "degraded":
    case "minor":
      return "degraded"
    case "partial-outage":
    case "partial":
      return "partial_outage"
    case "major-outage":
    case "critical":
    case "down":
    case "outage":
      return "major_outage"
    case "under-maintenance":
    case "maintenance":
    case "scheduled":
      return "maintenance"
    default:
      return "unknown"
  }
}

export type UptimeComComponent = {
  id?: number | string
  name?: string
  status?: string
  is_group?: boolean
  sorting_weight?: number
  subcomponents?: UptimeComComponent[] | null
}

export type UptimeComIncident = {
  id?: number | string
  name?: string
  title?: string
  status?: string
  incident_type?: string
  type?: string
  severity?: string
  started_at?: string | null
  start_date?: string | null
  created_at?: string | null
  resolved_at?: string | null
  end_date?: string | null
  ends_at?: string | null
  url?: string | null
  public_url?: string | null
}

export type UptimeComStatuspage = {
  id?: number | string
  name?: string
  slug?: string
  cname_url?: string
  public_url?: string
  global_is_operational?: boolean
  components?: UptimeComComponent[] | null
  active_incidents?: UptimeComIncident[] | null
  upcoming_maintenance?: UptimeComIncident[] | null
}

export type UptimeComControllerProps = {
  siteURL?: string
  brandName?: string
  updateStatusPageURL?: string
  statuspage?: UptimeComStatuspage
}

const CONTROLLER_START_RE = /createElement\(\s*StatusPageDisplayController\s*,\s*\{/

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function flattenComponents(items: UptimeComComponent[] | null | undefined): UptimeComComponent[] {
  const out: UptimeComComponent[] = []
  for (const item of items ?? []) {
    if (!item) continue
    if (item.is_group) {
      out.push(...flattenComponents(item.subcomponents))
      continue
    }
    out.push(item)
    if (item.subcomponents?.length) out.push(...flattenComponents(item.subcomponents))
  }
  return out
}

function mapIncident(item: UptimeComIncident, fallbackStatus: string): MappedIncident | null {
  const title = (item.title ?? item.name ?? "").trim()
  if (!title || item.id == null) return null
  const status = (item.status ?? fallbackStatus).toLowerCase()
  const closed = CLOSED_STATUSES.has(status) || Boolean(item.resolved_at ?? item.end_date ?? item.ends_at)
  return {
    externalId: String(item.id),
    title,
    status: closed ? "resolved" : status,
    impact: item.incident_type ?? item.type ?? item.severity ?? null,
    url: item.url ?? item.public_url ?? null,
    startedAt: toIso(item.started_at ?? item.start_date ?? item.created_at),
    resolvedAt: closed ? toIso(item.resolved_at ?? item.end_date ?? item.ends_at) : null,
  }
}

/** Map an Uptime.com statuspage object into our normalized shape. */
export function mapUptimeComPage(page: UptimeComStatuspage, pageUrl: string): MappedServiceState {
  const components: MappedComponent[] = flattenComponents(page.components)
    .filter((component) => component.id != null && component.name)
    .map((component) => ({
      externalId: String(component.id),
      name: component.name as string,
      status: mapUptimeComStatus(component.status),
      position: typeof component.sorting_weight === "number" ? component.sorting_weight : null,
    }))

  if (components.length === 0) {
    throw new Error(`Uptime.com page for ${pageUrl} had no components`)
  }

  const incidents: MappedIncident[] = []
  for (const item of page.active_incidents ?? []) {
    const mapped = mapIncident(item, "investigating")
    if (mapped) incidents.push(mapped)
  }
  for (const item of page.upcoming_maintenance ?? []) {
    const mapped = mapIncident(item, "in_progress")
    if (mapped) incidents.push({ ...mapped, impact: mapped.impact ?? "maintenance" })
  }

  const open = incidents.find((incident) => incident.resolvedAt == null)
  const fromMaintenance = (page.upcoming_maintenance ?? []).length > 0 ? "maintenance" : "operational"
  const fromFlag = page.global_is_operational === false ? "unknown" : "operational"

  return {
    status: worstStatus([
      worstStatus(components.map((component) => component.status)),
      fromMaintenance,
      fromFlag === "unknown" && open ? mapUptimeComStatus(open.impact) : fromFlag,
    ]),
    incidentTitle: open?.title ?? null,
    detail: {
      source: "uptime_com",
      pageUrl,
      pageName: page.name ?? null,
      slug: page.slug ?? null,
    },
    components,
    incidents,
  }
}

function extractBalancedJsonObject(html: string, braceIndex: number): string {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = braceIndex; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === "\\") {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return html.slice(braceIndex, i + 1)
    }
  }
  throw new Error("Uptime.com StatusPageDisplayController props were truncated")
}

export function parseUptimeComControllerProps(html: string): UptimeComControllerProps {
  const match = html.match(CONTROLLER_START_RE)
  if (!match || match.index == null) {
    throw new Error("Uptime.com HTML had no StatusPageDisplayController props")
  }
  const brace = html.indexOf("{", match.index)
  let parsed: unknown
  try {
    parsed = JSON.parse(extractBalancedJsonObject(html, brace)) as unknown
  } catch (err) {
    if (err instanceof Error && err.message.includes("truncated")) throw err
    throw new Error("Uptime.com StatusPageDisplayController props are not valid JSON")
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Uptime.com StatusPageDisplayController props were empty")
  }
  return parsed as UptimeComControllerProps
}

/**
 * Fetch the public Uptime.com page and map the embedded controller payload.
 * Throws on network error, timeout, non-2xx, or unparseable HTML.
 */
export async function fetchUptimeComState(
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
  const props = parseUptimeComControllerProps(html)
  const page = props.statuspage
  if (!page || typeof page !== "object") {
    throw new Error(`Uptime.com HTML from ${root} had no statuspage payload`)
  }
  return mapUptimeComPage(page, root)
}
