/**
 * Worker freshness for `/healthz`.
 *
 * The board treats data as stale after 3 missed polls (`BOARD_STALE_AFTER_MS`
 * in `lib/board-freshness.ts`, 15 minutes at the default 5 minute interval).
 * The same window is applied here from the configured refresh interval so a
 * process whose last *successful* tick is older than that reports unhealthy.
 * Railway's deploy healthcheck only promotes a revision when `/healthz` is
 * 200; a wedged process must not keep reporting healthy.
 *
 * Before the first success, the anchor is process start. The grace is at
 * least the tick deadline so a deploy healthcheck (and a slow first fan-out)
 * is not failed while that tick is still inside its budget.
 */

export function workerStaleAfterMs(refreshIntervalSeconds: number): number {
  return refreshIntervalSeconds * 3 * 1000
}

export function isWorkerTickFresh(input: {
  startedAtMs: number
  lastSuccessfulTickAtMs: number | null
  now: number
  staleAfterMs: number
  /** Extra boot grace used only while no tick has succeeded yet. */
  startupGraceMs?: number
}): boolean {
  if (input.lastSuccessfulTickAtMs == null) {
    const grace = Math.max(input.staleAfterMs, input.startupGraceMs ?? 0)
    return input.now - input.startedAtMs <= grace
  }
  return input.now - input.lastSuccessfulTickAtMs <= input.staleAfterMs
}

export function workerHealthStatus(input: {
  startedAtMs: number
  lastSuccessfulTickAtMs: number | null
  now: number
  refreshIntervalSeconds: number
  startupGraceMs?: number
}): { httpStatus: 200 | 503; status: "ok" | "stale"; staleAfterSeconds: number } {
  const staleAfterMs = workerStaleAfterMs(input.refreshIntervalSeconds)
  const fresh = isWorkerTickFresh({ ...input, staleAfterMs })
  return {
    httpStatus: fresh ? 200 : 503,
    status: fresh ? "ok" : "stale",
    staleAfterSeconds: Math.round(staleAfterMs / 1000),
  }
}
