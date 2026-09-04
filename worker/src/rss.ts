/**
 * RSS/Atom status-feed fetcher + mapper (SMA-22: xAI + DeepSeek).
 *
 * Unlike Statuspage-compatible services there is no summary endpoint: the feed is a
 * flat list of incident items. Each item embeds its lifecycle state in the
 * description HTML ("Status: RESOLVED" for xAI, "<strong>Status:</strong>
 * resolved" for DeepSeek), so we strip tags and parse best-effort. Overall
 * service status is derived from open (unresolved) incidents; a clean feed
 * means operational. Components are intentionally not extracted — neither
 * feed carries a reliable component grid (out of scope per SMA-22).
 */

import type { MappedIncident, ServiceStatus } from "./statuspage.js"
import type { PersistableServiceState } from "./store.js"

export type RssItem = {
  /** guid (RSS) or id (Atom); falls back to link when the feed omits it. */
  externalId: string | null
  title: string
  link: string | null
  /** pubDate (RSS) or published/updated (Atom), as it appears in the feed. */
  publishedAt: string | null
  /** description/summary/content with tags stripped and entities decoded. */
  text: string
  /** RSS <category> values, lowercased (xAI tags severity + lifecycle). */
  categories: string[]
}

// ---------------------------------------------------------------------------
// Minimal XML helpers. Status feeds are small and flat, so a tolerant
// regex-based extractor avoids pulling an XML parser dependency into the
// worker. This is NOT a general XML parser — it only handles the shapes
// produced by RSS 2.0 / Atom status feeds (see test fixtures).
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

export function decodeXmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16)
      return Number.isNaN(code) ? match : String.fromCodePoint(code)
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10)
      return Number.isNaN(code) ? match : String.fromCodePoint(code)
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

/** Unwrap CDATA sections, then decode entities. */
function decodeXmlText(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  return decodeXmlEntities(unwrapped).trim()
}

/** Drop HTML tags and collapse whitespace so text is regex-searchable. */
export function stripHtml(html: string): string {
  return decodeXmlEntities(
    html
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li|hr\s*\/?)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
}

/** First occurrence of <tag>...</tag> inside a block, decoded; null if absent. */
function tagContent(block: string, tag: string): string | null {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"),
  )
  return match ? decodeXmlText(match[1]) : null
}

function allTagContents(block: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi")
  for (const match of block.matchAll(re)) {
    out.push(decodeXmlText(match[1]))
  }
  return out
}

/** Atom links live in the href attribute: <link href="..." rel="alternate"/>. */
function atomLinkHref(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*)>/gi)].map((m) => m[1])
  const pick = (attrs: string): string | null =>
    attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? null
  const alternate = links.find((attrs) => /rel\s*=\s*"alternate"/i.test(attrs))
  if (alternate) {
    return pick(alternate)
  }
  const plain = links.find((attrs) => !/rel\s*=/i.test(attrs))
  return plain ? pick(plain) : null
}

/**
 * Parse an RSS 2.0 or Atom feed into a flat item list. Throws when the
 * payload is not recognizably a feed (so callers can mark the service stale).
 */
export function parseFeed(xml: string): RssItem[] {
  const isRss = /<rss[\s>]/i.test(xml) || /<channel[\s>]/i.test(xml)
  const isAtom = /<feed[\s>]/i.test(xml)
  if (!isRss && !isAtom) {
    throw new Error("payload is neither an RSS nor an Atom feed")
  }

  const blockTag = isRss ? "item" : "entry"
  const blocks = [
    ...xml.matchAll(new RegExp(`<${blockTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${blockTag}>`, "gi")),
  ].map((m) => m[1])

  const items: RssItem[] = []
  for (const block of blocks) {
    const title = tagContent(block, "title")
    if (!title) {
      continue
    }
    const link = isRss ? tagContent(block, "link") : atomLinkHref(block)
    const guid = isRss ? tagContent(block, "guid") : tagContent(block, "id")
    const publishedAt = isRss
      ? tagContent(block, "pubDate")
      : (tagContent(block, "published") ?? tagContent(block, "updated"))
    const body = isRss
      ? (tagContent(block, "description") ?? tagContent(block, "content:encoded") ?? "")
      : (tagContent(block, "content") ?? tagContent(block, "summary") ?? "")

    items.push({
      externalId: guid || link || null,
      title,
      link,
      publishedAt,
      text: stripHtml(body),
      categories: allTagContents(block, "category").map((c) => c.toLowerCase()),
    })
  }
  return items
}

// ---------------------------------------------------------------------------
// Mapping feed items -> normalized service state
// ---------------------------------------------------------------------------

/** Lifecycle states that mean the incident is over (mirrors lib/live-status.ts). */
const CLOSED_STATUSES = new Set(["resolved", "completed", "postmortem"])

const KNOWN_LIFECYCLE_STATUSES = new Set([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "completed",
  "postmortem",
])

/**
 * Extract the incident lifecycle state from an item. Both xAI and DeepSeek
 * embed a "Status: <state>" line in the description; xAI additionally tags
 * a "resolved" category and a "Resolved: <date>" line.
 */
export function extractIncidentStatus(item: RssItem): string {
  const statusLine = item.text.match(/\bstatus:\s*([a-z_ ]+)/i)?.[1]?.trim().toLowerCase()
  if (statusLine && KNOWN_LIFECYCLE_STATUSES.has(statusLine)) {
    return statusLine
  }
  if (statusLine === "ongoing") {
    return "investigating"
  }
  if (item.categories.some((c) => CLOSED_STATUSES.has(c))) {
    return "resolved"
  }
  if (/^resolved:\s*\S/im.test(item.text)) {
    return "resolved"
  }
  // Unrecognized state word (e.g. a vendor-specific label): keep it verbatim
  // so the UI can show it; unknown words are treated as open incidents.
  return statusLine ?? "investigating"
}

/** "Resolved: Thu, 03 Sep 2026 17:08:11 GMT" -> ISO timestamp (xAI). */
function extractResolvedAt(item: RssItem): string | null {
  const line = item.text.match(/^resolved:\s*(.+)$/im)?.[1]?.trim()
  return line ? toIso(line) : null
}

/** "Severity: available" (xAI) -> impact label; null when absent. */
function extractImpact(item: RssItem): string | null {
  const severity = item.text.match(/\bseverity:\s*([a-z_ -]+)/i)?.[1]?.trim().toLowerCase()
  return severity || null
}

function toIso(raw: string | null): string | null {
  if (!raw) {
    return null
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Best-effort severity of one open incident from its title + body keywords.
 * Covers DeepSeek's bilingual titles (部分中断 = partial outage, 性能下降 =
 * degraded performance) and xAI's "<something> outage" titles.
 */
export function classifyOpenIncident(item: RssItem): ServiceStatus {
  const haystack = `${item.title}\n${item.text}`.toLowerCase()
  if (/major outage|全面中断/.test(haystack)) {
    return "major_outage"
  }
  if (/outage|unavailable|中断|不可用/.test(haystack)) {
    return "partial_outage"
  }
  if (/maintenance|维护/.test(haystack)) {
    return "maintenance"
  }
  if (/degraded|performance|elevated|性能下降|延迟/.test(haystack)) {
    return "degraded"
  }
  return "degraded"
}

const STATUS_SEVERITY_ORDER: ServiceStatus[] = [
  "operational",
  "maintenance",
  "degraded",
  "partial_outage",
  "major_outage",
]

function worstStatus(statuses: ServiceStatus[]): ServiceStatus {
  let worst: ServiceStatus = "operational"
  for (const status of statuses) {
    if (STATUS_SEVERITY_ORDER.indexOf(status) > STATUS_SEVERITY_ORDER.indexOf(worst)) {
      worst = status
    }
  }
  return worst
}

export type RssFeedMeta = {
  feedUrl: string
  feedTitle: string | null
  lastBuildDate: string | null
}

/**
 * Map parsed feed items into the normalized service state persisted by
 * store.ts. Overall status: operational when every incident in the feed is
 * closed, otherwise the worst keyword-classified severity among open items.
 */
export function mapRssFeed(
  items: RssItem[],
  meta: RssFeedMeta,
  maxIncidents = 25,
): PersistableServiceState {
  const incidents: MappedIncident[] = []
  const openSeverities: ServiceStatus[] = []
  let headline: string | null = null

  for (const item of items.slice(0, maxIncidents)) {
    if (!item.externalId) {
      continue
    }
    const status = extractIncidentStatus(item)
    const open = !CLOSED_STATUSES.has(status)
    if (open) {
      openSeverities.push(classifyOpenIncident(item))
      // Items are newest-first in both feeds; keep the first open title.
      headline ??= item.title
    }
    incidents.push({
      externalId: item.externalId,
      title: item.title,
      status,
      impact: extractImpact(item),
      url: item.link,
      startedAt: toIso(item.publishedAt),
      resolvedAt: open ? null : extractResolvedAt(item),
    })
  }

  return {
    status: worstStatus(openSeverities),
    incidentTitle: headline,
    detail: {
      source: "rss",
      feedUrl: meta.feedUrl,
      feedTitle: meta.feedTitle,
      lastBuildDate: meta.lastBuildDate,
      openIncidents: openSeverities.length,
    },
    // Neither feed exposes a component grid; extracting names from incident
    // text would be brittle HTML parsing, which SMA-22 rules out.
    components: [],
    incidents,
  }
}

export type RssFetchOptions = {
  timeoutMs: number
  userAgent: string
  maxIncidents?: number
}

async function fetchText(url: string, options: RssFetchOptions): Promise<string> {
  const res = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "user-agent": options.userAgent,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  return await res.text()
}

/**
 * Fetch and map live state from a service's status feed. `feedUrls` are
 * tried in order (e.g. DeepSeek serves both feed.rss and feed.atom); the
 * first one that fetches and parses wins. Throws when all candidates fail,
 * so the caller can keep last-known rows and mark the snapshot stale.
 */
export async function fetchRssState(
  feedUrls: readonly string[],
  options: RssFetchOptions,
): Promise<PersistableServiceState> {
  let lastError: Error | null = null
  for (const feedUrl of feedUrls) {
    try {
      const xml = await fetchText(feedUrl, options)
      const items = parseFeed(xml)
      const meta: RssFeedMeta = {
        feedUrl,
        feedTitle: tagContent(xml.replace(/<(item|entry)[\s>][\s\S]*/i, ""), "title"),
        lastBuildDate:
          tagContent(xml.replace(/<(item|entry)[\s>][\s\S]*/i, ""), "lastBuildDate") ??
          tagContent(xml.replace(/<(item|entry)[\s>][\s\S]*/i, ""), "updated"),
      }
      return mapRssFeed(items, meta, options.maxIncidents)
    } catch (err) {
      lastError = err as Error
      console.warn(`[rss] feed failed ${feedUrl}: ${lastError.message}`)
    }
  }
  throw lastError ?? new Error("no feed URLs configured")
}
