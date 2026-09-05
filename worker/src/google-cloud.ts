/**
 * Google Cloud Status fetcher + mapper (SMA-26, Google Gemini).
 *
 * Vertex Gemini (and sibling Gemini* Cloud products) have no dedicated
 * Statuspage. Google publishes a public incidents feed:
 *   https://status.cloud.google.com/incidents.json
 * plus a product catalog at products.json. We treat an incident as Gemini-
 * relevant when it lists Vertex Gemini API (`Z0FZJAMvEB4j3NbCJs6B`) or
 * another product whose title contains "Gemini". Open incidents (`end`
 * null/absent) drive overall status; a quiet feed is operational.
 *
 * products.json is best-effort: a failure still yields a snapshot from
 * incidents.json, with components synthesized from the incident payload.
 */

import type {
  FetchOptions,
  MappedComponent,
  MappedIncident,
  MappedServiceState,
  ServiceStatus,
} from "./statuspage.js"

/** Vertex Gemini API — the product id Statussy tracks as Google Gemini. */
export const VERTEX_GEMINI_API_PRODUCT_ID = "Z0FZJAMvEB4j3NbCJs6B"

export const GOOGLE_CLOUD_STATUS_ORIGIN = "https://status.cloud.google.com"
export const GOOGLE_CLOUD_INCIDENTS_URL = `${GOOGLE_CLOUD_STATUS_ORIGIN}/incidents.json`
export const GOOGLE_CLOUD_PRODUCTS_URL = `${GOOGLE_CLOUD_STATUS_ORIGIN}/products.json`

export type GoogleCloudProduct = {
  id: string
  title?: string
  current_title?: string
}

export type GoogleCloudIncident = {
  id: string
  number?: string
  begin?: string | null
  created?: string | null
  end?: string | null
  modified?: string | null
  external_desc?: string
  status_impact?: string | null
  severity?: string | null
  uri?: string | null
  affected_products?: GoogleCloudProduct[] | null
}

const SEVERITY_RANK: Record<ServiceStatus, number> = {
  operational: 0,
  unknown: 1,
  maintenance: 2,
  degraded: 3,
  partial_outage: 4,
  major_outage: 5,
}

function worst(a: ServiceStatus, b: ServiceStatus): ServiceStatus {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a
}

/** True when the Cloud Status product is Vertex Gemini API or a Gemini* sibling. */
export function isGeminiProduct(product: Pick<GoogleCloudProduct, "id" | "title" | "current_title">): boolean {
  if (product.id === VERTEX_GEMINI_API_PRODUCT_ID) return true
  const title = product.title ?? ""
  const current = product.current_title ?? ""
  return /\bGemini\b/i.test(title) || /\bGemini\b/i.test(current)
}

export function productDisplayName(product: Pick<GoogleCloudProduct, "title" | "current_title">): string {
  return (product.current_title || product.title || "").trim()
}

/** Open = still ongoing. `end` missing, null, or blank counts as open. */
export function isOpenIncident(incident: Pick<GoogleCloudIncident, "end">): boolean {
  return incident.end == null || incident.end === ""
}

export function incidentAffectsGemini(incident: Pick<GoogleCloudIncident, "affected_products">): boolean {
  return (incident.affected_products ?? []).some((product) => isGeminiProduct(product))
}

/**
 * Cloud Status `status_impact` (and `severity` as fallback) → our enum.
 * SERVICE_OUTAGE / high → major_outage; SERVICE_DISRUPTION / medium →
 * partial_outage; SERVICE_INFORMATION / low → degraded.
 */
export function mapGoogleCloudImpact(
  statusImpact: string | null | undefined,
  severity?: string | null,
): ServiceStatus {
  switch ((statusImpact ?? "").toUpperCase()) {
    case "SERVICE_OUTAGE":
      return "major_outage"
    case "SERVICE_DISRUPTION":
      return "partial_outage"
    case "SERVICE_INFORMATION":
      return "degraded"
    case "SERVICE_MAINTENANCE":
      return "maintenance"
    default:
      break
  }
  switch ((severity ?? "").toLowerCase()) {
    case "high":
      return "major_outage"
    case "medium":
      return "partial_outage"
    case "low":
      return "degraded"
    default:
      return "unknown"
  }
}

/** Statuspage-style impact label for the incidents table. */
export function mapGoogleCloudImpactLabel(statusImpact: string | null | undefined): string | null {
  switch ((statusImpact ?? "").toUpperCase()) {
    case "SERVICE_OUTAGE":
      return "critical"
    case "SERVICE_DISRUPTION":
      return "major"
    case "SERVICE_INFORMATION":
      return "minor"
    case "SERVICE_MAINTENANCE":
      return "maintenance"
    default:
      return statusImpact ? statusImpact.toLowerCase() : null
  }
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function incidentUrl(incident: GoogleCloudIncident, pageUrl: string): string {
  const root = pageUrl.replace(/\/+$/, "")
  if (incident.uri) {
    return `${root}/${incident.uri.replace(/^\/+/, "")}`
  }
  return `${root}/incidents/${incident.id}`
}

function compareNewestFirst(a: GoogleCloudIncident, b: GoogleCloudIncident): number {
  const aKey = a.begin ?? a.created ?? ""
  const bKey = b.begin ?? b.created ?? ""
  return bKey.localeCompare(aKey)
}

function geminiProductsFromCatalog(products: GoogleCloudProduct[]): GoogleCloudProduct[] {
  const seen = new Set<string>()
  const out: GoogleCloudProduct[] = []
  for (const product of products) {
    if (!product.id || !isGeminiProduct(product) || seen.has(product.id)) continue
    seen.add(product.id)
    out.push(product)
  }
  // Always surface Vertex Gemini API even if the catalog omitted it.
  if (!seen.has(VERTEX_GEMINI_API_PRODUCT_ID)) {
    out.unshift({
      id: VERTEX_GEMINI_API_PRODUCT_ID,
      title: "Vertex Gemini API",
      current_title: "Vertex Gemini API",
    })
  }
  return out
}

function geminiProductsFromIncidents(incidents: GoogleCloudIncident[]): GoogleCloudProduct[] {
  const byId = new Map<string, GoogleCloudProduct>()
  for (const incident of incidents) {
    for (const product of incident.affected_products ?? []) {
      if (!product.id || !isGeminiProduct(product) || byId.has(product.id)) continue
      byId.set(product.id, product)
    }
  }
  return geminiProductsFromCatalog([...byId.values()])
}

export type MapGoogleCloudOptions = {
  pageUrl?: string
  maxIncidents?: number
}

type MapGoogleCloudScope = MapGoogleCloudOptions & {
  matchesProduct: (product: GoogleCloudProduct) => boolean
  /**
   * Platform-wide card: SERVICE_INFORMATION / low-severity notices must not
   * paint the whole Google Cloud card. Gemini still treats them as degraded.
   */
  ignoreInformationalForOverall?: boolean
  /** Avoid dumping the full Cloud product catalog as Health components. */
  componentsFromAffectedOnly?: boolean
  alwaysIncludeProducts?: GoogleCloudProduct[]
}

function isInformationalImpact(incident: GoogleCloudIncident): boolean {
  const impact = (incident.status_impact ?? "").toUpperCase()
  if (impact === "SERVICE_INFORMATION") return true
  if (impact) return false
  return (incident.severity ?? "").toLowerCase() === "low"
}

function incidentMatchesScope(
  incident: Pick<GoogleCloudIncident, "affected_products">,
  matchesProduct: (product: GoogleCloudProduct) => boolean,
): boolean {
  const products = incident.affected_products ?? []
  if (products.length === 0) return true
  return products.some((product) => matchesProduct(product))
}

function mapGoogleCloudScoped(
  incidents: GoogleCloudIncident[],
  products: GoogleCloudProduct[] | null | undefined,
  options: MapGoogleCloudScope,
): MappedServiceState {
  const pageUrl = options.pageUrl ?? GOOGLE_CLOUD_STATUS_ORIGIN
  const scopedIncidents = incidents
    .filter((incident) => incident.id && incidentMatchesScope(incident, options.matchesProduct))
    .sort(compareNewestFirst)
    .slice(0, options.maxIncidents ?? 25)

  const openIncidents = scopedIncidents.filter(isOpenIncident)
  const statusIncidents = options.ignoreInformationalForOverall
    ? openIncidents.filter((incident) => !isInformationalImpact(incident))
    : openIncidents

  const mappedIncidents: MappedIncident[] = scopedIncidents.map((incident) => {
    const open = isOpenIncident(incident)
    return {
      externalId: incident.id,
      title: (incident.external_desc ?? "").trim() || incident.id,
      status: open ? "active" : "resolved",
      impact: mapGoogleCloudImpactLabel(incident.status_impact),
      url: incidentUrl(incident, pageUrl),
      startedAt: toIso(incident.begin ?? incident.created),
      resolvedAt: open ? null : toIso(incident.end),
    }
  })

  let status: ServiceStatus = "operational"
  for (const incident of statusIncidents) {
    const mapped = mapGoogleCloudImpact(incident.status_impact, incident.severity)
    status = worst(status, mapped === "unknown" ? "degraded" : mapped)
  }

  const catalog = Array.isArray(products) && products.length > 0 ? products : null
  let componentProducts: GoogleCloudProduct[]
  if (options.componentsFromAffectedOnly) {
    const byId = new Map<string, GoogleCloudProduct>()
    for (const incident of statusIncidents) {
      for (const product of incident.affected_products ?? []) {
        if (!product.id || !options.matchesProduct(product) || byId.has(product.id)) continue
        byId.set(product.id, product)
      }
    }
    componentProducts = [...byId.values()]
  } else if (catalog) {
    componentProducts = geminiProductsFromCatalog(catalog)
  } else {
    componentProducts = geminiProductsFromIncidents(scopedIncidents)
  }

  if (options.alwaysIncludeProducts) {
    const seen = new Set(componentProducts.map((product) => product.id))
    for (const product of options.alwaysIncludeProducts) {
      if (product.id && !seen.has(product.id)) {
        componentProducts.unshift(product)
        seen.add(product.id)
      }
    }
  }

  const affectedStatusByProduct = new Map<string, ServiceStatus>()
  for (const incident of statusIncidents) {
    const incidentStatus = mapGoogleCloudImpact(incident.status_impact, incident.severity)
    const signal = incidentStatus === "unknown" ? "degraded" : incidentStatus
    for (const product of incident.affected_products ?? []) {
      if (!product.id || !options.matchesProduct(product)) continue
      const previous = affectedStatusByProduct.get(product.id) ?? "operational"
      affectedStatusByProduct.set(product.id, worst(previous, signal))
    }
  }

  const components: MappedComponent[] = componentProducts
    .filter((product) => product.id && productDisplayName(product))
    .map((product, index) => ({
      externalId: product.id,
      name: productDisplayName(product),
      status: affectedStatusByProduct.get(product.id) ?? "operational",
      position: index,
    }))

  const titleIncident = statusIncidents[0] ?? null

  return {
    status,
    incidentTitle: titleIncident
      ? (titleIncident.external_desc ?? "").trim() || titleIncident.id
      : null,
    detail: {
      source: "google_cloud",
      pageUrl,
      openIncidentCount: openIncidents.length,
      productIds: componentProducts.map((product) => product.id),
    },
    components,
    incidents: mappedIncidents,
  }
}

/**
 * Map Cloud Status incidents (+ optional product catalog) into our
 * normalized service state. Only Gemini-relevant incidents are kept.
 */
export function mapGoogleCloud(
  incidents: GoogleCloudIncident[],
  products: GoogleCloudProduct[] | null | undefined,
  options: MapGoogleCloudOptions = {},
): MappedServiceState {
  return mapGoogleCloudScoped(incidents, products, {
    ...options,
    matchesProduct: isGeminiProduct,
  })
}

/**
 * Platform-wide Google Cloud card. Includes every product. Informational /
 * low-severity notices stay in the incident list but do not roll up to the
 * card. Components are only products currently affected by a disruption,
 * outage, or maintenance — not the full catalog.
 */
export function mapGoogleCloudPlatform(
  incidents: GoogleCloudIncident[],
  products: GoogleCloudProduct[] | null | undefined,
  options: MapGoogleCloudOptions = {},
): MappedServiceState {
  return mapGoogleCloudScoped(incidents, products, {
    ...options,
    matchesProduct: () => true,
    ignoreInformationalForOverall: true,
    componentsFromAffectedOnly: true,
  })
}

export function parseProductsPayload(body: unknown): GoogleCloudProduct[] {
  if (Array.isArray(body)) {
    return body.filter((item): item is GoogleCloudProduct => !!item && typeof item === "object" && "id" in item)
  }
  if (body && typeof body === "object" && Array.isArray((body as { products?: unknown }).products)) {
    return ((body as { products: unknown[] }).products).filter(
      (item): item is GoogleCloudProduct => !!item && typeof item === "object" && "id" in item,
    )
  }
  return []
}

async function fetchJson<T>(url: string, options: FetchOptions): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

async function fetchGoogleCloudPayloads(
  options: FetchOptions,
): Promise<{ incidents: GoogleCloudIncident[]; products: GoogleCloudProduct[] }> {
  const incidents = await fetchJson<unknown>(GOOGLE_CLOUD_INCIDENTS_URL, options)
  if (!Array.isArray(incidents)) {
    throw new Error(`Unexpected incidents.json payload from ${GOOGLE_CLOUD_STATUS_ORIGIN}`)
  }

  let products: GoogleCloudProduct[] = []
  try {
    const body = await fetchJson<unknown>(GOOGLE_CLOUD_PRODUCTS_URL, options)
    products = parseProductsPayload(body)
  } catch (err) {
    console.warn(`[google_cloud] products fetch failed: ${(err as Error).message}`)
  }

  return { incidents: incidents as GoogleCloudIncident[], products }
}

/**
 * Fetch and map live Gemini state from Google Cloud Status.
 * Throws on incidents.json network error, timeout, non-2xx, or unparseable
 * payload so the caller can keep last-known rows and mark the snapshot stale.
 * products.json is optional (logged + skipped on failure).
 */
export async function fetchGoogleCloudGeminiState(options: FetchOptions): Promise<MappedServiceState> {
  const { incidents, products } = await fetchGoogleCloudPayloads(options)
  return mapGoogleCloud(incidents, products, {
    pageUrl: GOOGLE_CLOUD_STATUS_ORIGIN,
    maxIncidents: options.maxIncidents,
  })
}

/** Fetch and map the platform-wide Google Cloud card (Cloud Wave A). */
export async function fetchGoogleCloudPlatformState(
  options: FetchOptions,
): Promise<MappedServiceState> {
  const { incidents, products } = await fetchGoogleCloudPayloads(options)
  return mapGoogleCloudPlatform(incidents, products, {
    pageUrl: GOOGLE_CLOUD_STATUS_ORIGIN,
    maxIncidents: options.maxIncidents,
  })
}
