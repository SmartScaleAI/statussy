/**
 * Shared conditional-GET helper (SMA-100).
 *
 * Statuspage / Instatus / Google Cloud Status feeds sit behind CDNs that
 * honor ETag / Last-Modified validators. This helper keeps an in-memory
 * validator + body cache per URL: when a prior response carried validators
 * they are replayed as If-None-Match / If-Modified-Since, and a 304 reuses
 * the cached body instead of re-downloading the payload. Responses without
 * validators fall back to a plain full GET every tick, so freshness is
 * unchanged (the request still goes out every tick — only the transfer is
 * skipped when the feed says nothing changed).
 */

export type HttpOptions = {
  timeoutMs: number
  userAgent: string
}

type ValidatorCacheEntry = {
  etag: string | null
  lastModified: string | null
  body: string
}

/**
 * Bodies above this size are never pinned in memory (e.g. accidental HTML
 * dumps); those URLs simply fall back to a full GET each tick.
 */
const MAX_CACHED_BODY_BYTES = 4 * 1024 * 1024

const validatorCache = new Map<string, ValidatorCacheEntry>()

export type ConditionalFetchStats = {
  /** Conditional-capable GETs issued since the last drain. */
  requests: number
  /** How many of them came back 304 and reused the cached body. */
  notModified: number
}

let stats: ConditionalFetchStats = { requests: 0, notModified: 0 }

/** Read and reset the counters; the tick loop logs them once per tick. */
export function drainConditionalFetchStats(): ConditionalFetchStats {
  const drained = stats
  stats = { requests: 0, notModified: 0 }
  return drained
}

/** Test hook: forget all cached validators and bodies. */
export function clearValidatorCache(): void {
  validatorCache.clear()
}

/**
 * GET `url`, sending cached validators when known. Returns the response body,
 * which on a 304 is the cached body from the last full response. Throws on
 * network error, timeout, or non-2xx (other than 304).
 */
export async function fetchBodyConditional(
  url: string,
  options: HttpOptions,
  accept = "application/json",
): Promise<string> {
  const cached = validatorCache.get(url)
  const headers: Record<string, string> = {
    accept,
    "user-agent": options.userAgent,
  }
  if (cached?.etag) headers["if-none-match"] = cached.etag
  if (cached?.lastModified) headers["if-modified-since"] = cached.lastModified

  stats.requests += 1
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  })

  if (res.status === 304) {
    // Drain the empty body so undici can reuse the connection.
    await res.arrayBuffer().catch(() => undefined)
    if (!cached) {
      // We only send validators when a body is cached, so a bare 304 means
      // the server is misbehaving; fail the fetch (next tick is a full GET).
      throw new Error(`GET ${url} -> HTTP 304 with no cached body`)
    }
    stats.notModified += 1
    return cached.body
  }

  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`)
  }

  const body = await res.text()
  const etag = res.headers.get("etag")
  const lastModified = res.headers.get("last-modified")
  if ((etag || lastModified) && body.length <= MAX_CACHED_BODY_BYTES) {
    validatorCache.set(url, { etag, lastModified, body })
  } else {
    validatorCache.delete(url)
  }
  return body
}

/** Conditional GET + JSON.parse. Same error behavior as fetchBodyConditional. */
export async function fetchJsonConditional<T>(
  url: string,
  options: HttpOptions,
): Promise<T> {
  const body = await fetchBodyConditional(url, options)
  return JSON.parse(body) as T
}
