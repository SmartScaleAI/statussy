/**
 * Sorry™ status-page fetcher (SMA-66: Pipedrive, SMA-72: AB Tasty).
 *
 * Sorry pages expose `/api/v1/status`, `/api/v1/components`, and
 * `/api/v1/notices` (components and notices are paginated). `recovering`
 * is a vendor post-fix state: the notice stays listed but Sorry no longer
 * treats it as current, so it does not paint the card. Page `state`
 * remains the overall rollup.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export const PIPEDRIVE_STATUS_PAGE = "https://status.pipedrive.com"
export const PIPEDRIVE_SORRY_API = `${PIPEDRIVE_STATUS_PAGE}/api/v1`

export type SorryPage = {
  id?: number | string
  name?: string
  state?: string | null
  state_text?: string | null
  url?: string | null
  updated_at?: string | null
}

export type SorryStatus = {
  page?: SorryPage
}

export type SorryComponent = {
  id?: number | string
  name?: string
  state?: string | null
  parent_id?: number | string | null
  position?: number | null
}

export type SorryNoticeUpdate = {
  id?: number | string
  state?: string | null
  content?: string | null
}

export type SorryNotice = {
  id?: number | string
  type?: string | null
  state?: string | null
  timeline_state?: string | null
  subject?: string | null
  url?: string | null
  began_at?: string | null
  ended_at?: string | null
  updated_at?: string | null
  latest_update?: SorryNoticeUpdate | null
}

export type SorryListMeta = {
  count?: number
  total_count?: number
  next_page?: string | null
}

export type SorryComponentList = {
  components?: SorryComponent[] | null
  meta?: SorryListMeta
}

export type SorryNoticeList = {
  notices?: SorryNotice[] | null
  meta?: SorryListMeta
}

/** Notice states that still paint the card. `recovering` is not among them. */
export const SORRY_OPEN_NOTICE_STATES = new Set([
  "investigating",
  "identified",
  "monitoring",
  "underway",
  "in_progress",
])

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeState(state: string | null | undefined): string {
  return (state ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_")
}

/** Sorry page / component / notice state → our service_status enum. */
export function mapSorryState(state: string | null | undefined): ServiceStatus {
  switch (normalizeState(state)) {
    case "operational":
    case "resolved":
    case "completed":
    case "cancelled":
      return "operational"
    case "degraded":
    case "degraded_performance":
    case "recovering":
      return "degraded"
    case "partial_outage":
      return "partial_outage"
    case "major_outage":
      return "major_outage"
    case "maintenance":
    case "under_maintenance":
    case "scheduled":
    case "underway":
      return "maintenance"
    default:
      return "unknown"
  }
}

export function isSorryNoticeOpen(notice: SorryNotice): boolean {
  const state = normalizeState(notice.state)
  if (state === "recovering" || state === "resolved" || state === "cancelled") {
    return false
  }
  if (notice.ended_at) return false
  if (normalizeState(notice.type) === "planned" && state === "scheduled") {
    return false
  }
  return SORRY_OPEN_NOTICE_STATES.has(state)
}

export type SorryPayload = {
  status: SorryStatus
  components: SorryComponent[]
  notices: SorryNotice[]
}

/**
 * Map a Sorry™ status + component + notice payload.
 * `recovering` notices stay in the list but do not roll up the card.
 */
export function mapSorry(payload: SorryPayload, pageUrl: string): MappedServiceState {
  const page = payload.status.page
  if (!page || typeof page !== "object") {
    throw new Error(`Sorry status payload from ${pageUrl} had no page`)
  }

  const components: MappedComponent[] = payload.components
    .filter((component) => component.id != null && component.name)
    .map((component) => ({
      externalId: String(component.id),
      name: component.name as string,
      status: mapSorryState(component.state),
      position: typeof component.position === "number" ? component.position : null,
    }))

  const notices = payload.notices.filter((notice) => notice.id != null && notice.subject)
  const mappedIncidents: MappedIncident[] = notices.map((notice) => {
    const open = isSorryNoticeOpen(notice)
    const state = normalizeState(notice.state) || "unknown"
    return {
      externalId: String(notice.id),
      title: notice.subject as string,
      status: state,
      impact: notice.type ?? null,
      url: notice.url ?? `${pageUrl.replace(/\/+$/, "")}/notices/${notice.id}`,
      startedAt: toIso(notice.began_at),
      resolvedAt: open ? null : toIso(notice.ended_at ?? notice.updated_at),
    }
  })

  const pageStatus = mapSorryState(page.state)
  const fromOpen = worstStatus(
    notices.filter(isSorryNoticeOpen).map((notice) => {
      const mapped = mapSorryState(notice.state)
      return mapped === "unknown" ? "degraded" : mapped
    }),
  )
  // Page state is authoritative. Recovering-only notices must not override
  // an operational page (Sorry no longer treats those as current).
  const status = worstStatus([pageStatus === "unknown" ? "operational" : pageStatus, fromOpen])
  const headline = notices.find(isSorryNoticeOpen)

  return {
    status,
    incidentTitle: headline?.subject ?? null,
    detail: {
      source: "sorry",
      pageState: page.state ?? null,
      pageName: page.name ?? null,
      pageUpdatedAt: page.updated_at ?? null,
      pageUrl: page.url ?? pageUrl,
    },
    components,
    incidents: mappedIncidents,
  }
}

export type SorryFetchOptions = FetchOptions & {
  fetchImpl?: typeof fetch
}

async function fetchJson<T>(
  url: string,
  options: SorryFetchOptions,
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch
  const res = await fetchImpl(url, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

function nextPageUrl(baseUrl: string, nextPage: string | null | undefined): string | null {
  if (!nextPage) return null
  if (nextPage.startsWith("http://") || nextPage.startsWith("https://")) return nextPage
  const root = new URL(baseUrl)
  return new URL(nextPage, `${root.protocol}//${root.host}`).toString()
}

export async function fetchSorryPages<TItem, TBody extends { meta?: SorryListMeta }>(
  firstUrl: string,
  options: SorryFetchOptions,
  readItems: (body: TBody) => TItem[] | null | undefined,
  maxItems: number,
  maxPages = 8,
): Promise<TItem[]> {
  const items: TItem[] = []
  let url: string | null = firstUrl
  let pages = 0
  while (url && items.length < maxItems && pages < maxPages) {
    const body = await fetchJson<TBody>(url, options)
    const batch = readItems(body) ?? []
    items.push(...batch)
    pages += 1
    url = nextPageUrl(firstUrl, body.meta?.next_page)
  }
  return items.slice(0, maxItems)
}

/**
 * Fetch and map a Sorry™ status page.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchSorryState(
  baseUrl: string,
  options: SorryFetchOptions,
): Promise<MappedServiceState> {
  const root = baseUrl.replace(/\/+$/, "")
  const api = `${root}/api/v1`
  const status = await fetchJson<SorryStatus>(`${api}/status`, options)
  if (!status || typeof status !== "object" || !status.page) {
    throw new Error(`Unexpected Sorry status payload from ${api}/status`)
  }

  const components = await fetchSorryPages<SorryComponent, SorryComponentList>(
    `${api}/components`,
    options,
    (body) => body.components,
    200,
  )
  const notices = await fetchSorryPages<SorryNotice, SorryNoticeList>(
    `${api}/notices`,
    options,
    (body) => body.notices,
    options.maxIncidents ?? 25,
  )

  return mapSorry({ status, components, notices }, root)
}
