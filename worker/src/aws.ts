/**
 * AWS Health Dashboard fetcher (SMA-63).
 *
 * Seed comments used to say AWS has no public JSON. That is stale:
 * `GET https://health.aws.amazon.com/public/currentevents` returns the
 * current-events list as UTF-16 JSON. An empty array is operational.
 * RSS `https://status.aws.amazon.com/rss/all.rss` is a history feed
 * without lifecycle markers, so it is not used for the rollup.
 *
 * No component grid: `impacted_services` is a region × product dump
 * (Health would look like a service matrix). Incidents are the events.
 */

import type {
  FetchOptions,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { worstStatus } from "./statuspage.js"

export const AWS_CURRENT_EVENTS_URL = "https://health.aws.amazon.com/public/currentevents"
export const AWS_STATUS_PAGE = "https://health.aws.amazon.com/health/status"

export type AwsEventLogEntry = {
  summary?: string
  message?: string
  status?: number | string
  timestamp?: number | string
}

export type AwsCurrentEvent = {
  date?: string | number
  arn?: string
  region_name?: string
  status?: string | number
  service?: string
  service_name?: string
  summary?: string
  event_log?: AwsEventLogEntry[] | null
}

/**
 * AWS Health current-event severity (0–3) → our service_status enum.
 * 0 = none, 1 = info / investigating, 2 = degraded, 3 = disruption.
 */
export function mapAwsEventStatus(status: string | number | undefined | null): ServiceStatus {
  switch (String(status ?? "").trim()) {
    case "0":
      return "operational"
    case "1":
      return "degraded"
    case "2":
      return "partial_outage"
    case "3":
      return "major_outage"
    default:
      return "unknown"
  }
}

/** Decode the UTF-16 (BOM) or UTF-8 currentevents body. */
export function decodeAwsPayload(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes)
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes)
  }
  return new TextDecoder("utf-8").decode(bytes)
}

export function parseAwsCurrentEvents(payload: string): AwsCurrentEvent[] {
  const parsed: unknown = JSON.parse(payload)
  if (!Array.isArray(parsed)) {
    throw new Error("AWS currentevents payload is not a JSON array")
  }
  return parsed as AwsCurrentEvent[]
}

function unixToIso(value: string | number | undefined | null): string | null {
  if (value == null || value === "") return null
  const raw = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(raw)) return null
  const ms = raw > 1e12 ? raw : raw * 1000
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function eventTitle(event: AwsCurrentEvent): string {
  const summary = (event.summary ?? "").trim()
  const service = (event.service_name ?? "").trim()
  const region = (event.region_name ?? "").trim()
  const where = [service, region].filter(Boolean).join(" — ")
  if (summary && where) return `${where}: ${summary}`
  return summary || where || "AWS event"
}

function eventId(event: AwsCurrentEvent): string | null {
  if (event.arn) return event.arn
  if (event.service && event.date != null) return `${event.service}_${event.date}`
  return null
}

/**
 * Map AWS currentevents into our normalized snapshot.
 * Empty list = operational. Open events paint the card; no components.
 */
export function mapAwsCurrentEvents(
  events: AwsCurrentEvent[],
  options: { maxIncidents?: number } = {},
): MappedServiceState {
  const incidents: MappedIncident[] = []
  const severities: ServiceStatus[] = []
  let headline: string | null = null

  for (const event of events.slice(0, options.maxIncidents ?? 25)) {
    const externalId = eventId(event)
    const title = eventTitle(event)
    if (!externalId) continue
    const severity = mapAwsEventStatus(event.status)
    if (severity !== "operational" && severity !== "unknown") {
      severities.push(severity)
      headline ??= title
    }
    incidents.push({
      externalId,
      title,
      status: severity === "operational" ? "resolved" : "investigating",
      impact: severity === "unknown" ? null : severity,
      url: AWS_STATUS_PAGE,
      startedAt: unixToIso(event.date),
      resolvedAt: null,
    })
  }

  return {
    status: worstStatus(severities),
    incidentTitle: headline,
    detail: {
      source: "aws",
      eventCount: events.length,
      openEvents: severities.length,
    },
    components: [],
    incidents,
  }
}

export type AwsFetchOptions = FetchOptions & {
  fetchImpl?: typeof fetch
}

/**
 * Fetch and map live AWS state from public currentevents (UTF-16 JSON).
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchAwsState(options: AwsFetchOptions): Promise<MappedServiceState> {
  const fetchImpl = options.fetchImpl ?? fetch
  const res = await fetchImpl(AWS_CURRENT_EVENTS_URL, {
    headers: {
      accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      "user-agent": options.userAgent,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${AWS_CURRENT_EVENTS_URL} -> HTTP ${res.status}`)
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  const events = parseAwsCurrentEvents(decodeAwsPayload(bytes))
  return mapAwsCurrentEvents(events, { maxIncidents: options.maxIncidents })
}
