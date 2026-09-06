/**
 * Simple Analytics Jekyll incident-diary fetcher (SMA-45).
 *
 * The status page is a historical incident list (not a component board).
 * feed.xml is empty unless something is open; the HTML diary is the live
 * source so the card is not forever seed-operational.
 */

import {
  classifyOpenIncident,
  extractIncidentStatus,
  parseFeed,
  type RssItem,
} from "./rss.js"
import type { FetchOptions, MappedIncident, MappedServiceState, ServiceStatus } from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

const CLOSED_LABELS = new Set(["resolved", "completed", "postmortem"])

export type JekyllIncident = {
  id: string
  title: string
  href: string
  label: string
  startedAt: string | null
}

const INCIDENT_BLOCK =
  /<h3>\s*<a href="(\/incidents\/(\d+))">([^<]+)<\/a>\s*<\/h3>\s*<p>([\s\S]*?)<\/p>/gi

export function parseJekyllIncidents(html: string): JekyllIncident[] {
  const out: JekyllIncident[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(INCIDENT_BLOCK)) {
    const href = match[1]
    const id = match[2]
    const title = match[3].trim()
    const body = match[4]
    if (!title || seen.has(id)) continue
    seen.add(id)
    const label = (body.match(/class="label\s+([^"]+)"/i)?.[1] ?? "investigating")
      .trim()
      .toLowerCase()
    const startedAt = body.match(/<time datetime="([^"]+)"/i)?.[1] ?? null
    out.push({ id, title, href, label, startedAt })
  }
  return out
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function classifyLabel(label: string, title: string): ServiceStatus {
  if (CLOSED_LABELS.has(label)) return "operational"
  if (label === "maintenance") return "maintenance"
  return classifyOpenIncident({
    externalId: title,
    title,
    link: null,
    publishedAt: null,
    text: label,
    categories: [label],
  })
}

function mapHtmlIncidents(items: JekyllIncident[], pageUrl: string): MappedIncident[] {
  const root = pageUrl.replace(/\/+$/, "")
  return items.map((item) => {
    const closed = CLOSED_LABELS.has(item.label)
    return {
      externalId: item.id,
      title: item.title,
      status: closed ? "resolved" : item.label || "investigating",
      impact: null,
      url: `${root}${item.href}`,
      startedAt: toIso(item.startedAt),
      resolvedAt: closed ? toIso(item.startedAt) : null,
    }
  })
}

function mapRssIncidents(items: RssItem[], maxIncidents: number): MappedIncident[] {
  const incidents: MappedIncident[] = []
  for (const item of items.slice(0, maxIncidents)) {
    if (!item.externalId) continue
    const status = extractIncidentStatus(item)
    const closed = CLOSED_LABELS.has(status)
    incidents.push({
      externalId: item.externalId,
      title: item.title,
      status,
      impact: null,
      url: item.link,
      startedAt: toIso(item.publishedAt),
      resolvedAt: closed ? toIso(item.publishedAt) : null,
    })
  }
  return incidents
}

export function mapSimpleAnalyticsDiary(
  htmlIncidents: JekyllIncident[],
  rssItems: RssItem[],
  pageUrl: string,
  maxIncidents = 25,
): MappedServiceState {
  const fromHtml = mapHtmlIncidents(htmlIncidents, pageUrl).slice(0, maxIncidents)
  const incidents = fromHtml.length > 0 ? fromHtml : mapRssIncidents(rssItems, maxIncidents)
  const open = incidents.filter((incident) => !CLOSED_LABELS.has(incident.status))
  const openHtml = htmlIncidents.filter((item) => !CLOSED_LABELS.has(item.label))

  const severities: ServiceStatus[] = openHtml.map((item) => classifyLabel(item.label, item.title))
  if (severities.length === 0) {
    for (const incident of open) {
      severities.push(
        classifyOpenIncident({
          externalId: incident.externalId,
          title: incident.title,
          link: incident.url,
          publishedAt: incident.startedAt,
          text: incident.status,
          categories: [incident.status],
        }),
      )
    }
  }

  return {
    status: worstStatus(severities),
    incidentTitle: open[0]?.title ?? null,
    detail: {
      source: "simpleanalytics",
      pageUrl,
      incidentCount: incidents.length,
      openIncidents: open.length,
    },
    components: [],
    incidents,
  }
}

async function fetchText(
  url: string,
  options: FetchOptions,
  accept: string,
): Promise<string> {
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
 * Fetch the Jekyll HTML diary (and RSS as a fallback when the diary is empty).
 * Throws when the HTML page cannot be fetched.
 */
export async function fetchSimpleAnalyticsState(
  pageUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = pageUrl.replace(/\/+$/, "")
  const html = await fetchText(root, options, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
  const htmlIncidents = parseJekyllIncidents(html)

  let rssItems: RssItem[] = []
  try {
    const xml = await fetchText(
      `${root}/feed.xml`,
      options,
      "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    )
    rssItems = parseFeed(xml)
  } catch (err) {
    if (htmlIncidents.length === 0) {
      throw err
    }
    console.warn(`[simpleanalytics] feed.xml failed: ${(err as Error).message}`)
  }

  return mapSimpleAnalyticsDiary(htmlIncidents, rssItems, root, options.maxIncidents)
}
