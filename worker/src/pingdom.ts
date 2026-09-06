/**
 * Pingdom Public Reports mapper (SMA-72: Convert).
 *
 * status.convert.com is a Pingdom Public Reports table. The JS SPA loads
 * `/checks` via DataTables; `/noscript` is the same table as HTML.
 * Never point this fetcher at convert.statuspage.io — that host is an
 * unrelated example page (“conver to pdf free online”).
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

/** Unrelated Atlassian example page. Do not fetch. */
export const CONVERT_STATUSPAGE_IO = "https://convert.statuspage.io"

export function mapPingdomCheckStatus(token: string | undefined | null): ServiceStatus {
  const normalized = (token ?? "").trim().toLowerCase()
  if (normalized === "up" || normalized === "operational") return "operational"
  if (normalized === "unknown" || normalized === "unmonitored" || normalized === "paused") {
    return "unknown"
  }
  if (normalized === "down" || normalized === "outage") return "major_outage"
  return "unknown"
}

const CHECK_ROW =
  /<td class="check-status">[\s\S]*?<span class="status\s+([a-z]+)"[\s\S]*?<td class="check-name"><a[^>]*href="\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi

export function parsePingdomNoscript(html: string): MappedComponent[] {
  const components: MappedComponent[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(CHECK_ROW)) {
    const id = match[2]
    const name = match[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    components.push({
      externalId: id,
      name,
      status: mapPingdomCheckStatus(match[1]),
      position: components.length,
    })
  }
  return components
}

export type PingdomChecksPayload = {
  aaData?: string[][] | null
}

const STATUS_CLASS = /class="status\s+([a-z]+)"/i
const NAME_HREF = /href="\/(\d+)"[^>]*>([\s\S]*?)<\/a>/i

export function parsePingdomChecksJson(payload: PingdomChecksPayload): MappedComponent[] {
  const components: MappedComponent[] = []
  const seen = new Set<string>()
  for (const row of payload.aaData ?? []) {
    const statusHtml = row[0] ?? ""
    const nameHtml = row[1] ?? ""
    const status = statusHtml.match(STATUS_CLASS)?.[1]
    const named = nameHtml.match(NAME_HREF)
    if (!named) continue
    const id = named[1]
    const name = named[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    components.push({
      externalId: id,
      name,
      status: mapPingdomCheckStatus(status),
      position: components.length,
    })
  }
  return components
}

export function mapPingdomComponents(
  components: MappedComponent[],
  pageUrl: string,
): MappedServiceState {
  if (components.length === 0) {
    throw new Error(`Pingdom Public Reports at ${pageUrl} had no checks`)
  }
  if (/convert\.statuspage\.io/i.test(pageUrl)) {
    throw new Error("convert.statuspage.io is an unrelated example page; do not fetch it")
  }
  return {
    status: worstStatus(components.map((component) => component.status)),
    incidentTitle: null,
    detail: {
      source: "pingdom",
      pageUrl,
    },
    components,
    incidents: [],
  }
}

async function fetchText(url: string, options: FetchOptions, accept: string): Promise<string> {
  const res = await fetch(url, {
    headers: { accept, "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  return await res.text()
}

/**
 * Fetch Convert's Pingdom Public Reports.
 * Prefers the DataTables `/checks` JSON the SPA uses; falls back to `/noscript`.
 * Never hits convert.statuspage.io.
 */
export async function fetchPingdomState(
  pageUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = pageUrl.replace(/\/+$/, "")
  if (/convert\.statuspage\.io/i.test(root)) {
    throw new Error("convert.statuspage.io is an unrelated example page; do not fetch it")
  }

  try {
    const raw = await fetchText(
      `${root}/checks?sEcho=1&iDisplayStart=0&iDisplayLength=100`,
      options,
      "application/json, text/javascript;q=0.9, */*;q=0.8",
    )
    const payload = JSON.parse(raw) as PingdomChecksPayload
    return mapPingdomComponents(parsePingdomChecksJson(payload), root)
  } catch {
    const html = await fetchText(`${root}/noscript`, options, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
    return mapPingdomComponents(parsePingdomNoscript(html), root)
  }
}
