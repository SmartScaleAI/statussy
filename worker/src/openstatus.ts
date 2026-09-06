/**
 * OpenStatus summary fetcher (SMA-73: Traefik).
 *
 * Pages like status.traefik.io expose GET /api/status/summary.json —
 * Statuspage-shaped page + indicator + named components, but components
 * have no ids and incidents ride along in the same payload (no /api/v2).
 * Missing ids use the component / incident name as the persist key.
 * Active-only incidents are resolved at persist time.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
} from "./statuspage.js"
import { mapComponentStatus, mapIndicator } from "./statuspage.js"

export type OpenstatusComponent = {
  id?: string
  name?: string
  status?: string
}

export type OpenstatusIncident = {
  id?: string
  name?: string
  title?: string
  status?: string
  impact?: string | null
  shortlink?: string | null
  url?: string | null
  created_at?: string | null
  started_at?: string | null
  resolved_at?: string | null
}

export type OpenstatusSummary = {
  page?: { name?: string; url?: string; updated_at?: string }
  status?: { indicator?: string; description?: string }
  components?: OpenstatusComponent[] | null
  incidents?: OpenstatusIncident[] | null
  scheduled_maintenances?: OpenstatusIncident[] | null
}

const OPEN_INCIDENT_STATUSES = new Set([
  "investigating",
  "identified",
  "monitoring",
  "in_progress",
  "verifying",
])

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function incidentTitle(item: OpenstatusIncident): string | null {
  const title = (item.name ?? item.title ?? "").trim()
  return title || null
}

function mapOpenstatusIncident(
  item: OpenstatusIncident,
  baseUrl: string,
  fallbackStatus: string,
): MappedIncident | null {
  const title = incidentTitle(item)
  if (!title) return null
  const externalId = item.id ?? title
  const status = (item.status ?? fallbackStatus).toLowerCase()
  return {
    externalId,
    title,
    status,
    impact: item.impact ?? null,
    url: item.shortlink ?? item.url ?? `${baseUrl.replace(/\/+$/, "")}/incidents/${externalId}`,
    startedAt: toIso(item.started_at ?? item.created_at),
    resolvedAt: toIso(item.resolved_at),
  }
}

/** Map an OpenStatus summary.json payload into our normalized shape. */
export function mapOpenstatus(summary: OpenstatusSummary, baseUrl: string): MappedServiceState {
  const root = baseUrl.replace(/\/+$/, "")
  const components: MappedComponent[] = (summary.components ?? [])
    .filter((component) => component.name)
    .map((component, index) => ({
      externalId: component.id ?? (component.name as string),
      name: component.name as string,
      status: mapComponentStatus(component.status),
      position: index,
    }))

  const incidents: MappedIncident[] = []
  for (const item of summary.incidents ?? []) {
    const mapped = mapOpenstatusIncident(item, root, "unknown")
    if (mapped) incidents.push(mapped)
  }
  for (const item of summary.scheduled_maintenances ?? []) {
    const mapped = mapOpenstatusIncident(item, root, "maintenance")
    if (mapped) incidents.push(mapped)
  }

  const openIncident = incidents.find((incident) => OPEN_INCIDENT_STATUSES.has(incident.status))

  return {
    status: mapIndicator(summary.status?.indicator),
    incidentTitle: openIncident?.title ?? null,
    detail: {
      source: "openstatus",
      indicator: summary.status?.indicator ?? null,
      description: summary.status?.description ?? null,
      pageUpdatedAt: summary.page?.updated_at ?? null,
    },
    components,
    incidents,
  }
}

/**
 * Fetch and map live state for one OpenStatus page.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchOpenstatusState(
  baseUrl: string,
  options: FetchOptions,
): Promise<MappedServiceState> {
  const root = baseUrl.replace(/\/+$/, "")
  const url = `${root}/api/status/summary.json`
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  const body = (await res.json()) as OpenstatusSummary
  if (!body || typeof body !== "object" || !body.status) {
    throw new Error(`Unexpected OpenStatus summary.json payload from ${root}`)
  }
  return mapOpenstatus(body, root)
}
