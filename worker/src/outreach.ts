/**
 * Outreach status SPA fetcher (SMA-66).
 *
 * status.outreach.io is a JS SPA with no public JSON (`/api/v2`,
 * `/index.json`, and `/summary.json` all return the same HTML shell).
 * The page itself decides whether to flip to `/outage.html` by comparing
 * HEAD etags of `/index.html` and `/outage.html`. We do the same: equal
 * etags (or a missing outage document) is operational; a distinct outage
 * etag paints the card so it is not forever seed-operational.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export const OUTREACH_STATUS_PAGE = "https://status.outreach.io"
export const OUTREACH_INDEX_URL = `${OUTREACH_STATUS_PAGE}/index.html`
export const OUTREACH_OUTAGE_URL = `${OUTREACH_STATUS_PAGE}/outage.html`

/** Browser-like UA. The page is a CloudFront/S3 SPA. */
export const OUTREACH_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

export type OutreachFetchOptions = FetchOptions & {
  fetchImpl?: typeof fetch
}

export type OutreachProbe = {
  indexEtag: string | null
  outageEtag: string | null
  outageOk: boolean
  outageHtml: string | null
}

const TITLE_RE = /<title>([^<]+)<\/title>/i
const H1_RE = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i
const SPA_SHELL_RE = /OUTAGE_URL\s*=\s*["']\/outage\.html["']/i

function htmlUserAgent(configured: string): string {
  return configured.toLowerCase().startsWith("mozilla/") ? configured : OUTREACH_BROWSER_UA
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function parseOutreachOutageTitle(html: string): string {
  const heading = stripTags(html.match(H1_RE)?.[1] ?? "")
  if (heading && !SPA_SHELL_RE.test(html)) return heading
  const title = stripTags(html.match(TITLE_RE)?.[1] ?? "")
  if (title && !/^status\s*\|\s*outreach$/i.test(title) && !SPA_SHELL_RE.test(html)) {
    return title
  }
  return "Outreach outage"
}

export function outreachHasOutage(probe: OutreachProbe): boolean {
  if (!probe.outageOk) return false
  if (probe.outageHtml && !SPA_SHELL_RE.test(probe.outageHtml) && probe.outageHtml.trim() !== "") {
    return true
  }
  if (probe.indexEtag && probe.outageEtag && probe.indexEtag !== probe.outageEtag) {
    return true
  }
  return false
}

/** Map the index/outage etag probe into our normalized shape. */
export function mapOutreach(probe: OutreachProbe, pageUrl = OUTREACH_STATUS_PAGE): MappedServiceState {
  const outage = outreachHasOutage(probe)
  const status: ServiceStatus = outage ? "major_outage" : "operational"
  const title = outage ? parseOutreachOutageTitle(probe.outageHtml ?? "") : null

  const components: MappedComponent[] = [
    {
      externalId: "outreach",
      name: "Outreach",
      status,
      position: 0,
    },
  ]

  const incidents: MappedIncident[] = outage
    ? [
        {
          externalId: "outreach-outage",
          title: title ?? "Outreach outage",
          status: "investigating",
          impact: "critical",
          url: `${pageUrl.replace(/\/+$/, "")}/outage.html`,
          startedAt: null,
          resolvedAt: null,
        },
      ]
    : []

  return {
    status,
    incidentTitle: title,
    detail: {
      source: "outreach",
      indexEtag: probe.indexEtag,
      outageEtag: probe.outageEtag,
      outageOk: probe.outageOk,
    },
    components,
    incidents,
  }
}

async function request(
  url: string,
  method: "HEAD" | "GET",
  options: OutreachFetchOptions,
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch
  return fetchImpl(url, {
    method,
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "user-agent": htmlUserAgent(options.userAgent),
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
}

async function headThenGet(
  url: string,
  options: OutreachFetchOptions,
): Promise<{ ok: boolean; status: number; etag: string | null; body: string | null }> {
  const head = await request(url, "HEAD", options)
  const etag = head.headers.get("etag")
  if (head.status === 404 || head.status === 405 || !head.ok) {
    if (head.status === 404) {
      return { ok: false, status: 404, etag, body: null }
    }
    const get = await request(url, "GET", options)
    if (get.status === 404) {
      return { ok: false, status: 404, etag: get.headers.get("etag"), body: null }
    }
    if (!get.ok) {
      throw new Error(`GET ${url} -> HTTP ${get.status}`)
    }
    return {
      ok: true,
      status: get.status,
      etag: get.headers.get("etag") ?? etag,
      body: await get.text(),
    }
  }
  return { ok: true, status: head.status, etag, body: null }
}

/**
 * Probe the Outreach SPA index/outage flip and map live state.
 * Throws on network error, timeout, or a failed index fetch.
 */
export async function fetchOutreachState(
  options: OutreachFetchOptions,
  pageUrl = OUTREACH_STATUS_PAGE,
): Promise<MappedServiceState> {
  const root = pageUrl.replace(/\/+$/, "")
  const index = await headThenGet(`${root}/index.html`, options)
  if (!index.ok) {
    throw new Error(`GET ${root}/index.html -> HTTP ${index.status}`)
  }

  let outageOk = false
  let outageEtag: string | null = null
  let outageHtml: string | null = null
  try {
    const outage = await headThenGet(`${root}/outage.html`, options)
    outageOk = outage.ok
    outageEtag = outage.etag
    outageHtml = outage.body
    if (
      outage.ok &&
      index.etag &&
      outage.etag &&
      index.etag !== outage.etag &&
      outageHtml == null
    ) {
      const get = await request(`${root}/outage.html`, "GET", options)
      if (get.ok) outageHtml = await get.text()
    }
  } catch (err) {
    console.warn(`[outreach] outage.html probe failed: ${(err as Error).message}`)
  }

  return mapOutreach(
    {
      indexEtag: index.etag,
      outageEtag,
      outageOk,
      outageHtml,
    },
    root,
  )
}
