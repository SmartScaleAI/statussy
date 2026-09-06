/**
 * Honeybadger public-status HTML mapper (SMA-72: Flipper Cloud).
 *
 * status.flippercloud.io is a Honeybadger page (Website + API, 7-day
 * uptime). There is no /api/v2. incidents.atom exists and is often empty.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export function mapHoneybadgerTone(token: string | undefined | null): ServiceStatus {
  const normalized = (token ?? "").trim().toLowerCase()
  if (normalized === "up" || normalized === "operational") return "operational"
  if (normalized === "degraded" || normalized === "partial") return "degraded"
  if (normalized === "down" || normalized === "outage") return "major_outage"
  if (normalized === "maintenance") return "maintenance"
  return "unknown"
}

const SITE =
  /<div class="site">[\s\S]*?<div class="color-bar-([a-z]+)[^"]*"[\s\S]*?<a href="\/sites\/([^"]+)">([^<]+)<\/a>/gi
const SUMMARY_ACCENT = /All systems are\s+<span class="([a-z]+)-accent">([^<]+)<\/span>/i
const SUMMARY_PLAIN = /All systems (?:are )?(operational|down|degraded)/i

export function parseHoneybadgerOverall(html: string): ServiceStatus {
  const accent = html.match(SUMMARY_ACCENT)
  if (accent) {
    const fromClass = mapHoneybadgerTone(accent[1])
    if (fromClass !== "unknown") return fromClass
    return mapHoneybadgerTone(accent[2])
  }
  const plain = html.match(SUMMARY_PLAIN)
  return plain ? mapHoneybadgerTone(plain[1]) : "unknown"
}

export function parseHoneybadgerSites(html: string): MappedComponent[] {
  const components: MappedComponent[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(SITE)) {
    const id = match[2].trim()
    const name = match[3].trim()
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    components.push({
      externalId: id,
      name,
      status: mapHoneybadgerTone(match[1]),
      position: components.length,
    })
  }
  return components
}

/** Map a Honeybadger public status HTML page. */
export function mapHoneybadgerHtml(html: string, pageUrl: string): MappedServiceState {
  const components = parseHoneybadgerSites(html)
  if (components.length === 0) {
    throw new Error(`Honeybadger HTML from ${pageUrl} had no sites`)
  }
  const overall = parseHoneybadgerOverall(html)
  return {
    status: worstStatus([overall, ...components.map((component) => component.status)]),
    incidentTitle: null,
    detail: {
      source: "honeybadger",
      pageUrl,
    },
    components,
    incidents: [],
  }
}

/**
 * Fetch and map a Honeybadger HTML status page.
 * Throws on network error, timeout, non-2xx, or missing site tiles.
 */
export async function fetchHoneybadgerState(
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
  return mapHoneybadgerHtml(await res.text(), root)
}
