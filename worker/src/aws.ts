/**
 * AWS Health Dashboard fetcher (SMA-63).
 *
 * Seed comments used to say AWS has no public JSON. That is stale:
 * `GET https://health.aws.amazon.com/public/currentevents` returns the
 * current-events list as UTF-16 JSON. An empty array is operational.
 * RSS `https://status.aws.amazon.com/rss/all.rss` is a history feed
 * without lifecycle markers, so it is not used for the rollup.
 *
 * Regional rollup (SMA-78): currentevents are almost always region-scoped
 * (region code lives in the event ARN). A couple of disrupted regions must
 * not paint the whole card `major_outage`, so the card status is capped at
 * `partial_outage` unless an open event is global-scoped or disruptions span
 * at least MULTI_REGION_OUTAGE_THRESHOLD distinct regions.
 *
 * Components are one row per AWS region (bounded — never the full
 * `impacted_services` region × product dump), so Health reads as
 * "regions healthy / regions total" instead of collapsing to 0%.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"
import { STATUS_SEVERITY_RANK, worstStatus } from "./statuspage.js"

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

/**
 * Launched AWS commercial regions (code → dashboard-style display name).
 * This is the bounded component grid: one row per region, so Health is
 * "regions healthy / regions total". Regions AWS launches later still show
 * up — codes seen in events but missing here are appended dynamically.
 */
export const AWS_REGIONS: ReadonlyArray<{ code: string; name: string }> = [
  { code: "us-east-1", name: "N. Virginia" },
  { code: "us-east-2", name: "Ohio" },
  { code: "us-west-1", name: "N. California" },
  { code: "us-west-2", name: "Oregon" },
  { code: "af-south-1", name: "Cape Town" },
  { code: "ap-east-1", name: "Hong Kong" },
  { code: "ap-east-2", name: "Taipei" },
  { code: "ap-south-1", name: "Mumbai" },
  { code: "ap-south-2", name: "Hyderabad" },
  { code: "ap-southeast-1", name: "Singapore" },
  { code: "ap-southeast-2", name: "Sydney" },
  { code: "ap-southeast-3", name: "Jakarta" },
  { code: "ap-southeast-4", name: "Melbourne" },
  { code: "ap-southeast-5", name: "Malaysia" },
  { code: "ap-southeast-7", name: "Thailand" },
  { code: "ap-northeast-1", name: "Tokyo" },
  { code: "ap-northeast-2", name: "Seoul" },
  { code: "ap-northeast-3", name: "Osaka" },
  { code: "ca-central-1", name: "Canada Central" },
  { code: "ca-west-1", name: "Calgary" },
  { code: "eu-central-1", name: "Frankfurt" },
  { code: "eu-central-2", name: "Zurich" },
  { code: "eu-west-1", name: "Ireland" },
  { code: "eu-west-2", name: "London" },
  { code: "eu-west-3", name: "Paris" },
  { code: "eu-south-1", name: "Milan" },
  { code: "eu-south-2", name: "Spain" },
  { code: "eu-north-1", name: "Stockholm" },
  { code: "il-central-1", name: "Tel Aviv" },
  { code: "me-central-1", name: "UAE" },
  { code: "me-south-1", name: "Bahrain" },
  { code: "mx-central-1", name: "Mexico" },
  { code: "sa-east-1", name: "São Paulo" },
]

/**
 * Open disruptions in this many distinct regions (or any global-scoped
 * event) count as a broad outage: the card keeps the raw worst severity
 * (`major_outage` allowed). Below the threshold the card is capped at
 * `partial_outage` — a minority of regions is regional impact, not AWS down.
 */
export const MULTI_REGION_OUTAGE_THRESHOLD = 5

/**
 * Region code for one event: ARN region field (`arn:aws:health:<region>::…`),
 * else the `service` suffix (`multipleservices-me-central-1`). Returns null
 * for global-scoped events (no region, or the literal `global`).
 */
export function eventRegionCode(event: AwsCurrentEvent): string | null {
  const arnRegion = (event.arn ?? "").split(":")[3]?.trim().toLowerCase()
  const fromService = (event.service ?? "")
    .toLowerCase()
    .match(/-([a-z]{2}(?:-[a-z]+)+-\d+)$/)?.[1]
  const code = arnRegion || fromService || ""
  return code && code !== "global" ? code : null
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
 * Empty list = operational (all region components operational).
 *
 * Card status rule (SMA-78): worst open-event severity, capped at
 * `partial_outage` unless an open event is global-scoped or disruptions
 * span >= MULTI_REGION_OUTAGE_THRESHOLD distinct regions.
 */
export function mapAwsCurrentEvents(
  events: AwsCurrentEvent[],
  options: { maxIncidents?: number } = {},
): MappedServiceState {
  const incidents: MappedIncident[] = []
  const severities: ServiceStatus[] = []
  /** Worst open severity per affected region code. */
  const regionSeverity = new Map<string, ServiceStatus>()
  /** Display names from events, for regions missing from AWS_REGIONS. */
  const regionNames = new Map<string, string>()
  let hasGlobalOpenEvent = false
  let headline: string | null = null

  for (const event of events.slice(0, options.maxIncidents ?? 25)) {
    const externalId = eventId(event)
    const title = eventTitle(event)
    if (!externalId) continue
    const severity = mapAwsEventStatus(event.status)
    if (severity !== "operational" && severity !== "unknown") {
      severities.push(severity)
      headline ??= title
      const region = eventRegionCode(event)
      if (region) {
        regionSeverity.set(region, worstStatus([regionSeverity.get(region) ?? "operational", severity]))
        const displayName = (event.region_name ?? "").trim()
        if (displayName) regionNames.set(region, displayName)
      } else {
        hasGlobalOpenEvent = true
      }
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

  const rawWorst = worstStatus(severities)
  const broadOutage = hasGlobalOpenEvent || regionSeverity.size >= MULTI_REGION_OUTAGE_THRESHOLD
  const status =
    !broadOutage && STATUS_SEVERITY_RANK[rawWorst] > STATUS_SEVERITY_RANK.partial_outage
      ? "partial_outage"
      : rawWorst

  const knownCodes = new Set(AWS_REGIONS.map((region) => region.code))
  const extraRegions = [...regionSeverity.keys()]
    .filter((code) => !knownCodes.has(code))
    .sort()
    .map((code) => ({ code, name: regionNames.get(code) ?? code }))
  const components: MappedComponent[] = [...AWS_REGIONS, ...extraRegions].map(
    (region, index) => ({
      externalId: region.code,
      name: `${region.name} (${region.code})`,
      status: regionSeverity.get(region.code) ?? "operational",
      position: index,
    }),
  )

  return {
    status,
    incidentTitle: headline,
    detail: {
      source: "aws",
      eventCount: events.length,
      openEvents: severities.length,
      affectedRegions: [...regionSeverity.keys()].sort(),
      globalOpenEvent: hasGlobalOpenEvent,
    },
    components,
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
