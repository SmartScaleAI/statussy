/**
 * StatusCake HTML mapper (SMA-71: Mailchimp).
 *
 * status.mailchimp.com is a StatusCake page with no public JSON or RSS.
 * The HTML carries a banner (`#status-bar`), parent/child service tiles
 * (`.singleton-parent` / `.singleton-with-parent`), and a 7-day
 * `#outage_history` of `.box.event` rows. Banner text is the official
 * rollup — a single hidden US pod must not paint the card.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

const CLOSED_EVENT_STATUSES = new Set(["resolved", "completed", "postmortem"])

/** StatusCake banner class / copy -> our service_status enum. */
export function mapStatusCakeBanner(
  className: string | undefined | null,
  text: string | undefined | null,
): ServiceStatus {
  const classes = (className ?? "").toLowerCase()
  if (/\bis-success\b/.test(classes)) return "operational"
  if (/\bis-warning\b/.test(classes)) return "degraded"
  if (/\bis-info\b/.test(classes)) return "maintenance"
  if (/\bis-danger\b/.test(classes)) {
    const copy = (text ?? "").toLowerCase()
    return /major|offline|down/.test(copy) ? "major_outage" : "partial_outage"
  }

  const copy = (text ?? "").toLowerCase()
  if (/all systems are online|all systems operational/.test(copy)) return "operational"
  if (/maintenance/.test(copy)) return "maintenance"
  if (/degraded|experiencing issues/.test(copy)) return "degraded"
  if (/major outage|offline|down/.test(copy)) return "major_outage"
  if (/outage|disruption/.test(copy)) return "partial_outage"
  return "unknown"
}

/** StatusCake tile tag label / class -> our service_status enum. */
export function mapStatusCakeTag(
  label: string | undefined | null,
  className: string | undefined | null,
): ServiceStatus {
  const normalized = (label ?? "").trim().toLowerCase()
  if (normalized === "good service" || normalized === "operational") return "operational"
  if (
    normalized === "degraded performance" ||
    normalized === "degraded" ||
    normalized === "intermittent"
  ) {
    return "degraded"
  }
  if (normalized === "partial outage" || normalized === "service disruption") {
    return "partial_outage"
  }
  if (normalized === "major outage" || normalized === "down") return "major_outage"
  if (normalized === "under maintenance" || normalized === "maintenance") return "maintenance"

  const classes = (className ?? "").toLowerCase()
  if (/\bis-success\b/.test(classes)) return "operational"
  if (/\bis-warning\b/.test(classes)) return "degraded"
  if (/\bis-info\b/.test(classes)) return "maintenance"
  if (/\bis-danger\b/.test(classes)) return "major_outage"
  return "unknown"
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function parseStatusCakeBanner(html: string): {
  className: string
  text: string
} | null {
  const open = html.match(/<div\b([^>]*)\bid=["']status-bar["']([^>]*)>/i)
  if (!open) return null
  const attrs = `${open[1]} ${open[2]}`
  const className = attrs.match(/class=["']([^"']*)["']/)?.[1] ?? ""
  const start = (open.index ?? 0) + open[0].length
  const slice = html.slice(start, start + 800)
  const end = slice.search(/<\/div>/i)
  const inner = end === -1 ? slice : slice.slice(0, end + 800)
  return { className, text: stripTags(inner) }
}

export function parseStatusCakeComponents(html: string): MappedComponent[] {
  const components: MappedComponent[] = []
  const seen = new Set<string>()
  let lastParentSlug: string | null = null

  const tiles = [
    ...html.matchAll(
      /<div\b[^>]*class="[^"]*(singleton-parent|singleton-with-parent)[^"]*"[^>]*>([\s\S]*?)<span class="tag ([^"]+)">([^<]+)<\/span>/gi,
    ),
  ]

  for (const match of tiles) {
    const kind = match[1].toLowerCase()
    const body = match[2]
    const tagClass = match[3]
    const tagLabel = match[4].trim()
    const rawName = body
      .match(/<div class="level-left">\s*(?:<span>)?([^<]+)/i)?.[1]
      ?.replace(/^-\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
    if (!rawName) continue

    const slug = slugify(rawName)
    if (!slug) continue
    const isParent = kind.includes("singleton-parent")
    if (isParent) lastParentSlug = slug
    const externalId = isParent
      ? slug
      : lastParentSlug
        ? `${lastParentSlug}/${slug}`
        : slug
    if (seen.has(externalId)) continue
    seen.add(externalId)

    components.push({
      externalId,
      name: rawName,
      status: mapStatusCakeTag(tagLabel, tagClass),
      position: components.length,
    })
  }

  return components
}

export function parseStatusCakeEvents(html: string, pageUrl: string): MappedIncident[] {
  const root = pageUrl.replace(/\/+$/, "")
  const incidents: MappedIncident[] = []
  const seen = new Set<string>()
  const blocks = html.split(/<div class="box event /i).slice(1)

  for (const block of blocks) {
    const title = block.match(/<h3>([^<]+)<\/h3>/i)?.[1]?.trim()
    const detailsPath = block.match(/href="(\/details\/[^"]+)"/i)?.[1]
    if (!title || !detailsPath) continue
    const externalId = detailsPath.replace(/^\/details\//, "")
    if (!externalId || seen.has(externalId)) continue
    seen.add(externalId)

    const lifecycle = (block.match(/<strong>([^<]+)<\/strong>/i)?.[1] ?? "investigating")
      .trim()
      .toLowerCase()
    const created = block.match(/Created <span class="timestamp">([^<]+)<\/span>/i)?.[1]
    const resolvedStamp = /resolved/i.test(lifecycle)
      ? block.match(/Posted: <span class="timestamp">([^<]+)<\/span>/i)?.[1]
      : null
    const open = !CLOSED_EVENT_STATUSES.has(lifecycle)

    incidents.push({
      externalId,
      title,
      status: lifecycle,
      impact: null,
      url: `${root}${detailsPath}`,
      startedAt: toIso(created),
      resolvedAt: open ? null : toIso(resolvedStamp),
    })
  }

  return incidents
}

/**
 * Map a StatusCake HTML status page into our normalized shape.
 * Throws when the page has neither a banner nor service tiles.
 */
export function mapStatusCakeHtml(html: string, pageUrl: string): MappedServiceState {
  const banner = parseStatusCakeBanner(html)
  const components = parseStatusCakeComponents(html)
  if (!banner && components.length === 0) {
    throw new Error(`StatusCake HTML from ${pageUrl} had no banner or service tiles`)
  }

  const incidents = parseStatusCakeEvents(html, pageUrl)
  const open = incidents.find((incident) => !CLOSED_EVENT_STATUSES.has(incident.status))
  const fromBanner = banner ? mapStatusCakeBanner(banner.className, banner.text) : "unknown"

  return {
    status: fromBanner === "unknown" ? "operational" : fromBanner,
    incidentTitle: open?.title ?? null,
    detail: {
      source: "statuscake",
      pageUrl,
      banner: banner?.text ?? null,
    },
    components,
    incidents,
  }
}

/**
 * Fetch and map a StatusCake HTML status page.
 * Throws on network error, timeout, non-2xx, or unparseable HTML.
 */
export async function fetchStatusCakeState(
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
  return mapStatusCakeHtml(html, root)
}
