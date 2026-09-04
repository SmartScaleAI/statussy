/**
 * OnlineOrNot fetcher + mapper (SMA-21).
 *
 * OpenRouter's status page (status.openrouter.ai) is hosted on OnlineOrNot,
 * which exposes an unauthenticated summary API:
 *   https://api.onlineornot.com/v1/status_pages/{custom_domain}/summary
 *
 * The summary carries an overall status description, components, and
 * *active* incidents only (resolved incidents drop out of the feed), so the
 * persist step resolves incidents that disappear from the active list.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedProviderState,
  ProviderStatus,
} from "./statuspage.js"

export type OnlineOrNotComponent = {
  id: string
  name: string
  status?: string
  group_id?: string | null
}

export type OnlineOrNotIncident = {
  id: string
  title: string
  impact?: string | null
  started?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type OnlineOrNotSummary = {
  success?: boolean
  result?: {
    status?: { description?: string }
    status_page?: { id?: string; name?: string; subdomain?: string; custom_domain?: string }
    components?: OnlineOrNotComponent[] | null
    active_incidents?: OnlineOrNotIncident[] | null
    scheduled_maintenance?: OnlineOrNotIncident[] | null
  }
}

/** OnlineOrNot component status -> our provider_status enum. */
export function mapOnlineOrNotComponentStatus(status: string | undefined): ProviderStatus {
  switch (status?.toUpperCase()) {
    case "OPERATIONAL":
    case "NO_IMPACT":
      return "operational"
    case "DEGRADED_PERFORMANCE":
      return "degraded"
    case "PARTIAL_OUTAGE":
      return "partial_outage"
    case "MAJOR_OUTAGE":
      return "major_outage"
    case "MAINTENANCE":
    case "UNDER_MAINTENANCE":
      return "maintenance"
    default:
      return "unknown"
  }
}

/** OnlineOrNot incident impact (e.g. NO_IMPACT/MINOR/MAJOR/CRITICAL) -> Statuspage-style label. */
export function mapOnlineOrNotImpact(impact: string | null | undefined): string | null {
  if (!impact) return null
  const normalized = impact.toUpperCase()
  if (normalized === "NO_IMPACT") return "none"
  return normalized.toLowerCase()
}

/**
 * OnlineOrNot's summary has no machine indicator, only a human description
 * (e.g. "All Systems Operational"). Map recognizable phrases; unrecognized
 * descriptions fall back to the worst component status.
 */
export function mapOnlineOrNotDescription(description: string | undefined): ProviderStatus {
  const d = (description ?? "").toLowerCase()
  if (!d) return "unknown"
  if (d.includes("all systems operational") || d.includes("operational")) return "operational"
  if (d.includes("maintenance")) return "maintenance"
  if (d.includes("degraded")) return "degraded"
  if (d.includes("partial")) return "partial_outage"
  if (d.includes("major") || d.includes("critical")) return "major_outage"
  return "unknown"
}

// Higher = worse. 'unknown' ranks lowest so it never masks a real signal;
// overall status is only 'unknown' when no source yields a real status.
const SEVERITY: Record<ProviderStatus, number> = {
  unknown: 0,
  operational: 1,
  maintenance: 2,
  degraded: 3,
  partial_outage: 4,
  major_outage: 5,
}

function worst(a: ProviderStatus, b: ProviderStatus): ProviderStatus {
  return SEVERITY[b] > SEVERITY[a] ? b : a
}

/** Map an OnlineOrNot summary payload into our normalized shape. */
export function mapOnlineOrNot(summary: OnlineOrNotSummary, pageUrl: string): MappedProviderState {
  const result = summary.result ?? {}
  const base = pageUrl.replace(/\/+$/, "")

  const components: MappedComponent[] = (result.components ?? [])
    .filter((c) => c.id && c.name)
    .map((c, index) => ({
      externalId: c.id,
      name: c.name,
      status: mapOnlineOrNotComponentStatus(c.status),
      // OnlineOrNot components carry no explicit ordering; keep feed order.
      position: index,
    }))

  const incidents: MappedIncident[] = (result.active_incidents ?? [])
    .filter((i) => i.id && i.title)
    .map((i) => ({
      externalId: i.id,
      title: i.title,
      // The summary only lists active incidents and has no lifecycle field.
      status: "active",
      impact: mapOnlineOrNotImpact(i.impact),
      url: `${base}/incidents/${i.id}`,
      startedAt: i.started ?? i.created_at ?? null,
      resolvedAt: null,
    }))

  const description = result.status?.description
  const fromDescription = mapOnlineOrNotDescription(description)
  const fromComponents = components.reduce<ProviderStatus>(
    (acc, c) => worst(acc, c.status),
    "unknown",
  )

  return {
    status: worst(fromDescription, fromComponents),
    incidentTitle: incidents[0]?.title ?? null,
    detail: {
      source: "onlineornot",
      description: description ?? null,
      statusPageId: result.status_page?.id ?? null,
    },
    components,
    incidents,
  }
}

/**
 * Fetch and map live state for one OnlineOrNot-hosted status page.
 * `pageHost` is the page's custom domain (e.g. "status.openrouter.ai").
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchOnlineOrNotState(
  pageHost: string,
  options: FetchOptions,
): Promise<MappedProviderState> {
  const url = `https://api.onlineornot.com/v1/status_pages/${pageHost}/summary`
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  const body = (await res.json()) as OnlineOrNotSummary
  if (!body || typeof body !== "object" || body.success !== true || !body.result) {
    throw new Error(`Unexpected OnlineOrNot summary payload for ${pageHost}`)
  }
  return mapOnlineOrNot(body, `https://${pageHost}`)
}
