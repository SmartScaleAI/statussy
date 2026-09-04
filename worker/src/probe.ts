/**
 * Latency probes (SMA-23, phase 2 chicklet).
 *
 * Measures round-trip latency to a safe, public, unauthenticated endpoint per
 * provider — one tiny request per tick, nothing resembling scraping. This is
 * OUR measurement, deliberately separate from official vendor status:
 * a probe failure only yields "no latency this tick" (null) and must never
 * mark the provider's official status stale.
 */

export type ProbeTarget = {
  providerId: string
  /** Safe public endpoint. An auth-required response (401/403) still measures a full round trip. */
  url: string
  method: "GET" | "HEAD"
}

/**
 * Providers we probe. Only endpoints that are public, cheap to serve, and
 * fine to hit once per tick (default every 5 minutes) belong here. An
 * unauthenticated 401 from an API edge is a valid round-trip measurement.
 */
export const PROBE_TARGETS: readonly ProbeTarget[] = [
  { providerId: "openai", url: "https://api.openai.com/v1/models", method: "HEAD" },
] as const

export type ProbeOptions = {
  timeoutMs: number
  userAgent: string
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
  /** Injectable for tests. */
  now?: () => number
}

export type ProbeResult = {
  providerId: string
  /** Milliseconds, or null when the probe failed (timeout, network error). */
  latencyMs: number | null
}

/**
 * Time one request to the target. Any HTTP response — including 401/403/5xx —
 * counts as a measurement: the bytes made the round trip. Only a network
 * error or timeout returns null. Never throws.
 */
export async function probeLatency(
  target: ProbeTarget,
  options: ProbeOptions,
): Promise<ProbeResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? (() => performance.now())

  const startedAt = now()
  try {
    const res = await fetchImpl(target.url, {
      method: target.method,
      headers: { "user-agent": options.userAgent },
      signal: AbortSignal.timeout(options.timeoutMs),
      redirect: "follow",
    })
    // Drain/cancel the body so the connection is released promptly.
    await res.body?.cancel().catch(() => {})
    const latencyMs = Math.max(0, Math.round(now() - startedAt))
    return { providerId: target.providerId, latencyMs }
  } catch (err) {
    console.warn(`[probe] ${target.providerId} failed: ${(err as Error).message}`)
    return { providerId: target.providerId, latencyMs: null }
  }
}

/** Probe every configured target in parallel; failures come back as null. */
export async function probeAll(
  targets: readonly ProbeTarget[],
  options: ProbeOptions,
): Promise<Map<string, number | null>> {
  const results = await Promise.all(targets.map((target) => probeLatency(target, options)))
  return new Map(results.map((r) => [r.providerId, r.latencyMs]))
}
