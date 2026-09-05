/**
 * Oracle Cloud status fetcher + mapper (Cloud Wave C).
 *
 * OCI's public page is Statuspage-shaped at the top level
 * (`/api/v2/status.json` with `status.indicator`) but is not a full
 * Statuspage: summary.json and incidents.json 404, and components.json is a
 * ~1.7MB region × product dump. We read the page-level indicator only and
 * do not persist that catalog as Health components.
 */

import { mapIndicator, type FetchOptions, type MappedServiceState } from "./statuspage.js"

export const ORACLE_CLOUD_STATUS_URL =
  "https://ocistatus.oraclecloud.com/api/v2/status.json"
export const ORACLE_CLOUD_STATUS_PAGE = "https://ocistatus.oraclecloud.com"

export type OracleCloudStatus = {
  page?: { name?: string; updated_at?: string }
  status?: { indicator?: string; description?: string }
}

/**
 * Map OCI's page-level status.json into our normalized service state.
 */
export function mapOracleCloud(payload: OracleCloudStatus): MappedServiceState {
  return {
    status: mapIndicator(payload.status?.indicator),
    incidentTitle: null,
    detail: {
      source: "oracle_cloud",
      indicator: payload.status?.indicator ?? null,
      description: payload.status?.description ?? null,
      pageUpdatedAt: payload.page?.updated_at ?? null,
    },
    components: [],
    incidents: [],
  }
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

/**
 * Fetch and map live Oracle Cloud state from status.json.
 * Throws on network error, timeout, non-2xx, or unparseable payload.
 */
export async function fetchOracleCloudState(
  options: FetchOptions,
): Promise<MappedServiceState> {
  const payload = await fetchJson<OracleCloudStatus>(ORACLE_CLOUD_STATUS_URL, options)
  if (!payload || typeof payload !== "object" || !payload.status) {
    throw new Error(`Unexpected Oracle Cloud status payload from ${ORACLE_CLOUD_STATUS_URL}`)
  }
  return mapOracleCloud(payload)
}
