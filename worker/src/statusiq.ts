/**
 * Site24x7 StatusIQ RSS mapper (SMA-45: Matomo + Parse.ly).
 *
 * Those pages have no Statuspage /api/v2. Public RSS at {host}/rss lists
 * named components as "Name - Operational" (or a worse state). Guids are
 * date-based and collide, so component identity is the name.
 */

import { parseFeed, type RssItem } from "./rss.js"
import type { FetchOptions, MappedComponent, MappedServiceState, ServiceStatus } from "./statuspage.js"
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
