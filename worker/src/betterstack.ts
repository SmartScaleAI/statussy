/**
 * Better Stack status-page fetcher + mapper (SMA-41: Together AI + Hugging Face).
 *
 * Those pages are Better Stack SPAs with no Statuspage-style /api/v2 JSON.
 * The SPA loads an unauthenticated `{baseUrl}/index.json` (JSON:API-ish)
 * that carries page `aggregate_state`, resources (components), and
 * `status_report` rows. That payload is undocumented and may change; treat
 * this as a best-effort fetcher. Reports that drop out of `included` are
 * resolved at persist time (resolveMissingIncidents).
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

export type BetterstackPageAttributes = {
  company_name?: string
  aggregate_state?: string
  updated_at?: string
}

export type BetterstackResourceAttributes = {
  public_name?: string
  status?: string
  position?: number
}

export type BetterstackReportAttributes = {
  title?: string
  report_type?: string
  starts_at?: string | null
  ends_at?: string | null
  aggregate_state?: string
}

export type BetterstackIncluded = {
  id?: string
  type?: string
  attributes?: BetterstackResourceAttributes & BetterstackReportAttributes
}

export type BetterstackIndex = {
  data?: {
    id?: string
    type?: string
    attributes?: BetterstackPageAttributes
  }
  included?: BetterstackIncluded[] | null
}

const CLOSED_REPORT_STATES = new Set(["resolved", "completed", "postmortem"])

/** Better Stack page / resource status -> our service_status enum. */
export function mapBetterstackStatus(status: string | undefined | null): ServiceStatus {
  switch ((status ?? "").toLowerCase()) {
    case "operational":
      return "operational"
    case "degraded":
    case "degraded_performance":
      return "degraded"
    case "partial_outage":
      return "partial_outage"
    case "downtime":
    case "down":
    case "major_outage":
      return "major_outage"
    case "maintenance":
    case "under_maintenance":
      return "maintenance"
    default:
      return "unknown"
  }
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function reportSortKey(report: BetterstackIncluded): number {
  const started = Date.parse(report.attributes?.starts_at ?? "")
  return Number.isNaN(started) ? 0 : started
}

/** Map a Better Stack index.json payload into our normalized shape. */
export function mapBetterstack(index: BetterstackIndex, baseUrl: string): MappedServiceState {
  const root = baseUrl.replace(/\/+$/, "")
  const included = index.included ?? []
  const page = index.data?.attributes ?? {}

  const components: MappedComponent[] = included
    .filter((item) => item.type === "status_page_resource" && item.id && item.attributes?.public_name)
    .map((item) => ({
      externalId: item.id as string,
      name: item.attributes?.public_name as string,
      status: mapBetterstackStatus(item.attributes?.status),
      position: typeof item.attributes?.position === "number" ? item.attributes.position : null,
    }))

  const reports = included
    .filter((item) => item.type === "status_report" && item.id && item.attributes?.title)
    .slice()
    .sort((a, b) => reportSortKey(b) - reportSortKey(a))

  const incidents: MappedIncident[] = reports.map((item) => {
    const attrs = item.attributes ?? {}
    const state = (attrs.aggregate_state ?? "unknown").toLowerCase()
    const closed = CLOSED_REPORT_STATES.has(state)
    return {
      externalId: item.id as string,
      title: attrs.title as string,
      status: state,
      impact: attrs.report_type ?? null,
      url: `${root}/incidents/${item.id}`,
      startedAt: toIso(attrs.starts_at),
      resolvedAt: closed ? toIso(attrs.ends_at) : null,
    }
  })

  const openIncident = incidents.find((incident) => !CLOSED_REPORT_STATES.has(incident.status))

  return {
    status: mapBetterstackStatus(page.aggregate_state),
    incidentTitle: openIncident?.title ?? null,
    detail: {
      source: "betterstack",
      aggregateState: page.aggregate_state ?? null,
      companyName: page.company_name ?? null,
      pageUpdatedAt: page.updated_at ?? null,
    },
    components,
    incidents,
  }
}

/**
 * Fetch and map live state for one Better Stack status page.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchBetterstackState(
  baseUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = baseUrl.replace(/\/+$/, "")
  const url = `${root}/index.json`
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  const body = (await res.json()) as BetterstackIndex
  if (!body || typeof body !== "object" || !body.data?.attributes) {
    throw new Error(`Unexpected Better Stack index.json payload from ${root}`)
  }
  return mapBetterstack(body, root)
}
