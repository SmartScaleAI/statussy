/**
 * Checkly Nuxt status-page fetcher (SMA-25, Mistral).
 *
 * status.mistral.ai is a Checkly-hosted Nuxt SPA. There is no public JSON
 * API: /summary.json, RSS, and Instatus-style endpoints all return HTML.
 * Checkly's Status Pages REST API requires auth and is out of scope.
 *
 * The only public surface is the page HTML, which embeds a Nuxt 3
 * `__NUXT_DATA__` JSON payload (flattened integer-ref array) carrying:
 *   - unresolved-incidents-{pageId}
 *   - uptime-{pageId}        (component groups + 90-day uptime %)
 *   - maintenance-windows-{slug}
 *   - status-page-resolver-{domain}
 *
 * Brittleness (this fetcher will break before Statuspage/Instatus ones):
 *   - Nuxt payload wrapping (`ShallowReactive`) and key prefixes are SPA
 *     internals; a Checkly frontend deploy can rename them.
 *   - Cloudflare sits in front of the page and may challenge non-browser
 *     clients (we send a browser-like UA; a CF challenge HTML with no
 *     `__NUXT_DATA__` is a hard failure → stale-on-failure).
 *
 * Failures throw; the worker keeps last-known rows and marks the latest
 * snapshot stale. Do not scrape extra Checkly routes or call the private API.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedProviderState,
  ProviderStatus,
} from "./statuspage.js"

/** Browser-like UA. Cloudflare in front of Checkly pages often 403s bot UAs. */
export const CHECKLY_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

const NUXT_DATA_RE = /<script[^>]*\bid=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i

const NUXT_WRAPPER_TAGS = new Set([
  "ShallowReactive",
  "Reactive",
  "ShallowRef",
  "Ref",
  "EmptyRef",
  "EmptyShallowRef",
])

export type ChecklyFetchOptions = FetchOptions & {
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
}

export type ChecklyIncident = {
  id: string
  name: string
  severity?: string | null
  lastUpdateStatus?: string | null
  created_at?: string | null
  updated_at?: string | null
  services?: Array<{ id?: string; name?: string }> | null
}

export type ChecklyMaintenance = {
  id?: string
  name?: string
  title?: string
  start?: string | null
  startDate?: string | null
  startsAt?: string | null
  created_at?: string | null
}

export type ChecklyComponent = {
  id: string
  name: string
  /** 90-day vendor uptime percent (0–100), when the payload includes it. */
  uptime: number | null
  groupName: string | null
}

export type ChecklyPage = {
  statusPage: { id?: string; name?: string; customDomain?: string } | null
  incidents: ChecklyIncident[]
  components: ChecklyComponent[]
  activeMaintenance: ChecklyMaintenance[]
}

const SEVERITY_RANK: Record<ProviderStatus, number> = {
  unknown: 0,
  operational: 1,
  maintenance: 2,
  degraded: 3,
  partial_outage: 4,
  major_outage: 5,
}

function worst(a: ProviderStatus, b: ProviderStatus): ProviderStatus {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Checkly incident severity → our provider_status enum. */
export function mapChecklySeverity(severity: string | undefined | null): ProviderStatus {
  switch ((severity ?? "").toUpperCase()) {
    case "MINOR":
    case "MEDIUM":
      return "degraded"
    case "MAJOR":
      return "partial_outage"
    case "CRITICAL":
      return "major_outage"
    default:
      return "unknown"
  }
}

/** Normalize a vendor timestamp to ISO-8601, or null if absent/unparseable. */
function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Pull the `__NUXT_DATA__` JSON array out of a Checkly/Nuxt HTML page.
 * Throws when the script tag is missing or the contents are not a JSON array
 * (Cloudflare challenge pages, non-Nuxt HTML, truncated responses).
 */
export function extractNuxtData(html: string): unknown[] {
  const match = html.match(NUXT_DATA_RE)
  if (!match) {
    const challenge = /just a moment/i.test(html) || /cf-browser-verification/i.test(html)
    throw new Error(
      challenge
        ? "Cloudflare challenge HTML (no __NUXT_DATA__); refusing to parse"
        : "No __NUXT_DATA__ script in HTML (Nuxt schema change or non-Checkly page)",
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(match[1])
  } catch {
    throw new Error("__NUXT_DATA__ script is not valid JSON")
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("__NUXT_DATA__ is not a Nuxt payload array")
  }
  return parsed
}

/**
 * Revive Nuxt 3's flattened integer-ref payload into nested objects.
 * Object values and array elements that are numbers are indexes into the
 * same array; `["ShallowReactive", i]` / `["Ref", i]` unwrap to slot i.
 *
 * This is NOT a general devalue decoder — it only covers the Checkly status
 * page shape (see test fixture). A Nuxt major bump can invalidate it.
 */
export function hydrateNuxtPayload(payload: unknown[]): unknown {
  const cache: unknown[] = new Array(payload.length)
  const filled = new Array<boolean>(payload.length).fill(false)

  const revive = (index: number): unknown => {
    if (!Number.isInteger(index) || index < 0 || index >= payload.length) {
      return index
    }
    if (filled[index]) return cache[index]
    const value = payload[index]
    if (value === null || typeof value !== "object") {
      cache[index] = value
      filled[index] = true
      return value
    }
    if (Array.isArray(value)) {
      if (
        typeof value[0] === "string" &&
        NUXT_WRAPPER_TAGS.has(value[0]) &&
        typeof value[1] === "number"
      ) {
        const inner = revive(value[1])
        cache[index] = inner
        filled[index] = true
        return inner
      }
      if (value[0] === "Date" && value.length >= 2) {
        cache[index] = value[1]
        filled[index] = true
        return value[1]
      }
      if (value[0] === "undefined") {
        cache[index] = undefined
        filled[index] = true
        return undefined
      }
      const arr: unknown[] = []
      cache[index] = arr
      filled[index] = true
      for (const item of value) {
        arr.push(typeof item === "number" ? revive(item) : item)
      }
      return arr
    }
    const obj: Record<string, unknown> = {}
    cache[index] = obj
    filled[index] = true
    for (const [key, nested] of Object.entries(value)) {
      obj[key] = typeof nested === "number" ? revive(nested) : nested
    }
    return obj
  }

  return revive(0)
}

function hasChecklyKeys(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).some(
    (key) =>
      key.startsWith("unresolved-incidents-") ||
      key.startsWith("uptime-") ||
      key.startsWith("status-page-resolver-") ||
      key.startsWith("maintenance-windows-"),
  )
}

/** Locate the Checkly data bag regardless of ShallowReactive wrapping. */
export function findChecklyDataBag(hydrated: unknown): Record<string, unknown> {
  if (!isRecord(hydrated)) {
    throw new Error("Hydrated Nuxt payload is not an object")
  }
  if (isRecord(hydrated.data) && hasChecklyKeys(hydrated.data)) {
    return hydrated.data
  }
  if (hasChecklyKeys(hydrated)) {
    return hydrated
  }
  for (const value of Object.values(hydrated)) {
    if (isRecord(value) && hasChecklyKeys(value)) return value
    if (isRecord(value) && isRecord(value.data) && hasChecklyKeys(value.data)) {
      return value.data
    }
  }
  throw new Error(
    "Hydrated Nuxt payload has no Checkly keys (unresolved-incidents- / uptime- / status-page-resolver-)",
  )
}

function findByPrefix(bag: Record<string, unknown>, prefix: string): unknown {
  const key = Object.keys(bag).find((k) => k.startsWith(prefix))
  return key ? bag[key] : undefined
}

function readStatusPage(value: unknown): ChecklyPage["statusPage"] {
  if (!isRecord(value)) return null
  const page = isRecord(value.statusPage) ? value.statusPage : value
  return {
    id: asString(page.id) ?? undefined,
    name: asString(page.name) ?? undefined,
    customDomain: asString(page.customDomain) ?? undefined,
  }
}

function readIncidents(value: unknown): ChecklyIncident[] {
  if (!isRecord(value)) return []
  const list = value.incidents
  if (!Array.isArray(list)) return []
  const incidents: ChecklyIncident[] = []
  for (const item of list) {
    if (!isRecord(item)) continue
    const id = asString(item.id)
    const name = asString(item.name)
    if (!id || !name) continue
    const services = Array.isArray(item.services)
      ? item.services.flatMap((service) => {
          if (!isRecord(service)) return []
          return [
            {
              id: asString(service.id) ?? undefined,
              name: asString(service.name) ?? undefined,
            },
          ]
        })
      : []
    incidents.push({
      id,
      name,
      severity: asString(item.severity),
      lastUpdateStatus: asString(item.lastUpdateStatus),
      created_at: asString(item.created_at) ?? asString(item.createdAt),
      updated_at: asString(item.updated_at) ?? asString(item.updatedAt),
      services,
    })
  }
  return incidents
}

function readMaintenanceList(value: unknown): ChecklyMaintenance[] {
  if (!Array.isArray(value)) return []
  const windows: ChecklyMaintenance[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const id = asString(item.id)
    const name = asString(item.name) ?? asString(item.title)
    if (!id && !name) continue
    windows.push({
      id: id ?? undefined,
      name: name ?? undefined,
      start:
        asString(item.start) ??
        asString(item.startDate) ??
        asString(item.startsAt) ??
        asString(item.starts_at),
      created_at: asString(item.created_at) ?? asString(item.createdAt),
    })
  }
  return windows
}

type UptimeService = { id: string; name: string; order: number; uptime: number | null }
type UptimeGroup = {
  id: string
  name: string
  order: number
  uptime: number | null
  services: UptimeService[]
}

function readService(value: unknown, fallbackOrder: number): UptimeService | null {
  if (!isRecord(value)) return null
  const id = asString(value.id)
  const name = asString(value.name)
  if (!id || !name) return null
  return {
    id,
    name,
    order: asNumber(value.order) ?? fallbackOrder,
    uptime: asNumber(value.uptime),
  }
}

function readGroups(list: unknown): UptimeGroup[] {
  if (!Array.isArray(list)) return []
  const groups: UptimeGroup[] = []
  for (const [groupIndex, item] of list.entries()) {
    if (!isRecord(item)) continue
    const id = asString(item.id)
    const name = asString(item.name)
    if (!id || !name) continue
    const servicesRaw = Array.isArray(item.services) ? item.services : []
    const services: UptimeService[] = []
    for (const [serviceIndex, service] of servicesRaw.entries()) {
      const mapped = readService(service, serviceIndex)
      if (mapped) services.push(mapped)
    }
    services.sort((a, b) => a.order - b.order)
    groups.push({
      id,
      name,
      order: asNumber(item.order) ?? groupIndex,
      uptime: asNumber(item.uptime),
      services,
    })
  }
  groups.sort((a, b) => a.order - b.order)
  return groups
}

function readComponents(uptimeNode: unknown): ChecklyComponent[] {
  if (!isRecord(uptimeNode)) return []
  const metadataGroups = readGroups(uptimeNode.metadata)
  const uptimeGroups = readGroups(uptimeNode.uptime)

  const uptimeById = new Map<string, number>()
  for (const group of uptimeGroups) {
    if (group.uptime !== null) uptimeById.set(group.id, group.uptime)
    for (const service of group.services) {
      if (service.uptime !== null) uptimeById.set(service.id, service.uptime)
    }
  }

  const groups = metadataGroups.length > 0 ? metadataGroups : uptimeGroups
  const components: ChecklyComponent[] = []
  for (const group of groups) {
    for (const service of group.services) {
      components.push({
        id: service.id,
        name: service.name,
        uptime: service.uptime ?? uptimeById.get(service.id) ?? null,
        groupName: group.name,
      })
    }
  }
  return components
}

/** Parse Checkly page HTML into the structured fields we persist. */
export function parseChecklyNuxtHtml(html: string): ChecklyPage {
  const payload = extractNuxtData(html)
  const hydrated = hydrateNuxtPayload(payload)
  const bag = findChecklyDataBag(hydrated)

  const uptimeNode = findByPrefix(bag, "uptime-")
  const components = readComponents(uptimeNode)
  if (components.length === 0) {
    // Persisting an empty list would DELETE last-known components.
    throw new Error("Checkly Nuxt payload had no components (uptime- key missing or empty)")
  }

  const incidentNode = findByPrefix(bag, "unresolved-incidents-")
  const maintenanceNode = findByPrefix(bag, "maintenance-windows-")
  const activeMaintenance = isRecord(maintenanceNode)
    ? readMaintenanceList(maintenanceNode.active)
    : []

  return {
    statusPage: readStatusPage(findByPrefix(bag, "status-page-resolver-")),
    incidents: readIncidents(incidentNode),
    components,
    activeMaintenance,
  }
}

function htmlUserAgent(configured: string): string {
  return configured.toLowerCase().startsWith("mozilla/") ? configured : CHECKLY_BROWSER_UA
}

function incidentUrl(pageUrl: string, incidentId: string): string {
  const root = pageUrl.replace(/\/+$/, "")
  return `${root}/incident/${incidentId}`
}

/** Map a parsed Checkly page into our normalized snapshot shape. */
export function mapChecklyNuxt(page: ChecklyPage, pageUrl: string): MappedProviderState {
  const affectedStatus = new Map<string, ProviderStatus>()
  for (const incident of page.incidents) {
    const status = mapChecklySeverity(incident.severity)
    for (const service of incident.services ?? []) {
      if (!service.id) continue
      const current = affectedStatus.get(service.id) ?? "operational"
      affectedStatus.set(service.id, worst(current, status))
    }
  }

  const components: MappedComponent[] = page.components.map((component, index) => ({
    externalId: component.id,
    name: component.name,
    status: affectedStatus.get(component.id) ?? "operational",
    position: index,
  }))

  const incidents: MappedIncident[] = page.incidents.map((incident) => ({
    externalId: incident.id,
    title: incident.name,
    status: (incident.lastUpdateStatus ?? "unknown").toLowerCase(),
    impact: incident.severity ? incident.severity.toLowerCase() : null,
    url: incidentUrl(pageUrl, incident.id),
    startedAt: toIso(incident.created_at),
    resolvedAt: null,
  }))

  for (const window of page.activeMaintenance) {
    const id = window.id ?? window.name
    const title = window.name ?? window.title
    if (!id || !title) continue
    incidents.push({
      externalId: id,
      title,
      status: "maintenance",
      impact: "maintenance",
      url: pageUrl.replace(/\/+$/, ""),
      startedAt: toIso(window.start ?? window.created_at),
      resolvedAt: null,
    })
  }

  const fromIncidents = page.incidents.reduce<ProviderStatus>(
    (acc, incident) => worst(acc, mapChecklySeverity(incident.severity)),
    "unknown",
  )
  const fromComponents = components.reduce<ProviderStatus>(
    (acc, component) => worst(acc, component.status),
    "unknown",
  )
  let status = worst(fromIncidents, fromComponents)
  if (page.activeMaintenance.length > 0) {
    status = worst(status, "maintenance")
  }
  if (status === "unknown") {
    status = "operational"
  }

  const componentUptime: Record<string, number> = {}
  for (const component of page.components) {
    if (component.uptime !== null) componentUptime[component.id] = component.uptime
  }

  return {
    status,
    incidentTitle: page.incidents[0]?.name ?? page.activeMaintenance[0]?.name ?? null,
    detail: {
      source: "checkly_nuxt",
      pageId: page.statusPage?.id ?? null,
      pageName: page.statusPage?.name ?? null,
      customDomain: page.statusPage?.customDomain ?? null,
      unresolvedCount: page.incidents.length,
      componentUptime,
    },
    components,
    incidents,
  }
}

/**
 * Fetch the Checkly/Nuxt status page HTML and map it.
 * Throws on network error, timeout, non-2xx, Cloudflare challenge, or
 * unparseable/empty payload so the worker can mark the snapshot stale.
 */
export async function fetchChecklyNuxtState(
  pageUrl: string,
  options: ChecklyFetchOptions,
): Promise<MappedProviderState> {
  const root = pageUrl.replace(/\/+$/, "")
  const fetchImpl = options.fetchImpl ?? fetch
  const res = await fetchImpl(root + "/", {
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "user-agent": htmlUserAgent(options.userAgent),
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${root}/ -> HTTP ${res.status}`)
  }
  const html = await res.text()
  const page = parseChecklyNuxtHtml(html)
  const incidents = page.incidents.slice(0, options.maxIncidents ?? 25)
  return mapChecklyNuxt({ ...page, incidents }, root)
}
