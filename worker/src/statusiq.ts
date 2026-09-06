/**
 * Site24x7 StatusIQ mapper (SMA-45: Matomo + Parse.ly RSS; SMA-72: VWO API).
 *
 * RSS pages have no Statuspage /api/v2. Public RSS at {host}/rss lists
 * named components as "Name - Operational" (or a worse state). Guids are
 * date-based and collide, so component identity is the name.
 *
 * When RSS is off (`allow_rss_feed: false`), the public SPA still loads
 * `/sp/api/public/summary_details/statuspages/{enc_statuspage_id}`.
 */

import { parseFeed, type RssItem } from "./rss.js"
import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export function mapStatusiqComponentStatus(status: string | undefined | null): ServiceStatus {
  const normalized = (status ?? "").trim().toLowerCase()
  if (normalized === "operational" || normalized === "ok") return "operational"
  if (
    normalized === "degraded" ||
    normalized === "degraded performance" ||
    normalized === "performance issues"
  ) {
    return "degraded"
  }
  if (normalized === "partial outage" || normalized === "partial") return "partial_outage"
  if (
    normalized === "major outage" ||
    normalized === "down" ||
    normalized === "outage" ||
    normalized === "unavailable"
  ) {
    return "major_outage"
  }
  if (normalized === "under maintenance" || normalized === "maintenance") return "maintenance"
  if (normalized === "informational" || normalized === "information") return "operational"
  return "unknown"
}

const TITLE_STATUS = /^(.+?)\s+[-–—]\s+(.+)$/

export function parseStatusiqItem(item: RssItem): { name: string; status: ServiceStatus } | null {
  const titled = item.title.match(TITLE_STATUS)
  if (titled) {
    const name = titled[1].trim()
    if (!name) return null
    return { name, status: mapStatusiqComponentStatus(titled[2]) }
  }
  const described = item.text.match(/^(.+?)\s+is\s+(.+)$/i)
  if (described) {
    const name = described[1].trim()
    if (!name) return null
    return { name, status: mapStatusiqComponentStatus(described[2]) }
  }
  return null
}

export type StatusiqMeta = {
  feedUrl: string
  pageUrl: string
}

/** Map a StatusIQ RSS feed into named components (no incident diary). */
export function mapStatusiqFeed(items: RssItem[], meta: StatusiqMeta): MappedServiceState {
  const seen = new Set<string>()
  const components: MappedComponent[] = []

  for (const item of items) {
    const parsed = parseStatusiqItem(item)
    if (!parsed || seen.has(parsed.name)) continue
    seen.add(parsed.name)
    components.push({
      externalId: parsed.name,
      name: parsed.name,
      status: parsed.status,
      position: components.length,
    })
  }

  if (components.length === 0) {
    throw new Error(`StatusIQ feed at ${meta.feedUrl} had no named components`)
  }

  return {
    status: worstStatus(components.map((component) => component.status)),
    incidentTitle: null,
    detail: {
      source: "statusiq",
      feedUrl: meta.feedUrl,
      pageUrl: meta.pageUrl,
    },
    components,
    incidents: [],
  }
}

/**
 * Site24x7 StatusIQ numeric component / page statuses (SMA-72: VWO).
 * 1 Operational, 2 Degraded, 3 Partial outage, 4 Major outage,
 * 5 Maintenance, 6 Informational (does not paint the card).
 */
export function mapStatusiqNumericStatus(status: number | string | undefined | null): ServiceStatus {
  const code = typeof status === "string" ? Number.parseInt(status, 10) : status
  switch (code) {
    case 1:
    case 6:
      return "operational"
    case 2:
      return "degraded"
    case 3:
      return "partial_outage"
    case 4:
      return "major_outage"
    case 5:
      return "maintenance"
    default:
      return "unknown"
  }
}

export type StatusiqCurrentComponent = {
  enc_component_id?: string
  display_name?: string
  is_group?: boolean
  component_status?: number | string
  componentgroup_components?: StatusiqCurrentComponent[] | null
}

export type StatusiqActiveIncident = {
  enc_incident_id?: string
  incident_id?: string | number
  title?: string
  incident_title?: string
  display_name?: string
  status?: string | number
  incident_status?: string | number
  started_at?: string | null
  begin_time?: string | null
  permalink?: string | null
}

export type StatusiqSummaryDetails = {
  current_status?: StatusiqCurrentComponent[] | null
  active_incident_details?: StatusiqActiveIncident[] | null
  statuspage_details?: { status?: number | string; statuspage_url?: string } | null
}

const ENC_STATUSPAGE_ID = /enc_statuspage_id"\s*:\s*"([^"]+)"/

export function extractStatusiqPageId(html: string): string | null {
  const match = html.match(ENC_STATUSPAGE_ID)
  return match?.[1] ?? null
}

function flattenStatusiqComponents(
  rows: StatusiqCurrentComponent[] | null | undefined,
): MappedComponent[] {
  const components: MappedComponent[] = []
  const walk = (list: StatusiqCurrentComponent[] | null | undefined) => {
    if (!list) return
    for (const row of list) {
      if (row.is_group) {
        walk(row.componentgroup_components)
        continue
      }
      const name = (row.display_name ?? "").trim()
      const id = (row.enc_component_id ?? "").trim()
      if (!name || !id) continue
      components.push({
        externalId: id,
        name,
        status: mapStatusiqNumericStatus(row.component_status),
        position: components.length,
      })
    }
  }
  walk(rows)
  return components
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Map StatusIQ public summary_details JSON (used when RSS is off). */
export function mapStatusiqSummary(
  summary: StatusiqSummaryDetails,
  meta: { pageUrl: string; pageId: string },
): MappedServiceState {
  const components = flattenStatusiqComponents(summary.current_status)
  if (components.length === 0) {
    throw new Error(`StatusIQ summary for ${meta.pageUrl} had no named components`)
  }

  const incidents: MappedIncident[] = []
  for (const item of summary.active_incident_details ?? []) {
    const title = (item.title ?? item.incident_title ?? item.display_name ?? "").trim()
    const id = String(item.enc_incident_id ?? item.incident_id ?? "").trim()
    if (!title || !id) continue
    incidents.push({
      externalId: id,
      title,
      status: String(item.status ?? item.incident_status ?? "investigating").toLowerCase(),
      impact: null,
      url: item.permalink ?? `${meta.pageUrl}/#/incidents/${id}`,
      startedAt: toIso(item.started_at ?? item.begin_time),
      resolvedAt: null,
    })
  }

  const pageStatus = mapStatusiqNumericStatus(summary.statuspage_details?.status)
  return {
    status: worstStatus([pageStatus, ...components.map((component) => component.status)]),
    incidentTitle: incidents[0]?.title ?? null,
    detail: {
      source: "statusiq_api",
      pageUrl: meta.pageUrl,
      pageId: meta.pageId,
    },
    components,
    incidents,
  }
}

/**
 * Fetch StatusIQ when RSS is disabled (SMA-72: VWO).
 * Reads enc_statuspage_id from the public HTML, then the same
 * `/sp/api/public/summary_details/statuspages/{id}` JSON the SPA loads.
 */
export async function fetchStatusiqApiState(
  pageUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = pageUrl.replace(/\/+$/, "")
  const htmlRes = await fetch(root, {
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "user-agent": options.userAgent,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!htmlRes.ok) {
    throw new Error(`GET ${root} -> HTTP ${htmlRes.status}`)
  }
  const pageId = extractStatusiqPageId(await htmlRes.text())
  if (!pageId) {
    throw new Error(`StatusIQ HTML from ${root} had no enc_statuspage_id`)
  }

  const summaryUrl = `${root}/sp/api/public/summary_details/statuspages/${pageId}?period=1&timezone=UTC`
  const summaryRes = await fetch(summaryUrl, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!summaryRes.ok) {
    throw new Error(`GET ${summaryUrl} -> HTTP ${summaryRes.status}`)
  }
  const envelope = (await summaryRes.json()) as { code?: number; data?: StatusiqSummaryDetails }
  if (!envelope?.data || typeof envelope.data !== "object") {
    throw new Error(`Unexpected StatusIQ summary payload from ${summaryUrl}`)
  }
  return mapStatusiqSummary(envelope.data, { pageUrl: root, pageId })
}

/**
 * Fetch and map a StatusIQ public RSS board.
 * Throws on network error, timeout, non-2xx, or an empty/unparseable feed.
 */
export async function fetchStatusiqState(
  pageUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = pageUrl.replace(/\/+$/, "")
  const feedUrl = `${root}/rss`
  const res = await fetch(feedUrl, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "user-agent": options.userAgent,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${feedUrl} -> HTTP ${res.status}`)
  }
  const xml = await res.text()
  const items = parseFeed(xml)
  return mapStatusiqFeed(items, { feedUrl, pageUrl: root })
}
