/**
 * Per-tick wall-clock cap (Sep 21–22 hung refresh).
 *
 * A tick whose promise never settled left `tickInProgress` set, so every
 * later interval logged "previous tick still running" and did no work.
 * `/healthz` stayed 200, so Railway did not replace the process.
 *
 * Deadline choice: 15s inside the refresh interval (default 300s → 285s).
 * That is above the fan-out budget and still clears the skip-guard before
 * the next interval fires.
 *
 * Fan-out budget: ~450 services, concurrency 20 (see `POOL_MAX`), 10s HTTP
 * timeout, 250ms jitter → 23 waves × ~10.3s ≈ 236s. Checkout and statement
 * timeouts in `db.ts` bound the database side of each wave. When the
 * configured interval is shorter than that budget, the 240s floor wins so
 * a full timeout wave is not aborted early; the skip-guard may drop one
 * interval, and `/healthz` still fails once 3× the interval has passed.
 *
 * Losing the race does not cancel in-flight HTTP (those already use
 * AbortSignal timeouts). It fails this tick, logs the service ids still
 * in fetch slots, and clears the guard so the next interval can run.
 */

/** Worst-case HTTP fan-out (see file comment), rounded up. */
export const TICK_FANOUT_FLOOR_MS = 240_000

/** Leave the skip-guard clear before the next interval fires. */
export const TICK_DEADLINE_SLACK_MS = 15_000

export function tickDeadlineMs(refreshIntervalSeconds: number): number {
  const intervalMs = refreshIntervalSeconds * 1000
  const slightlyUnder = Math.max(1, intervalMs - TICK_DEADLINE_SLACK_MS)
  return Math.max(slightlyUnder, TICK_FANOUT_FLOOR_MS)
}

export class TickDeadlineError extends Error {
  readonly inFlight: readonly string[]

  constructor(deadlineMs: number, inFlight: Iterable<string>) {
    const list = [...inFlight].sort()
    const shown = list.length > 0 ? list.join(", ") : "none"
    super(
      `tick exceeded ${deadlineMs}ms deadline; in-flight (${list.length}): ${shown}`,
    )
    this.name = "TickDeadlineError"
    this.inFlight = list
  }
}

/**
 * Fail `work` if it is still pending after `deadlineMs`. A late rejection
 * from `work` is swallowed so it cannot surface as unhandled after the
 * deadline already settled this race.
 */
export function withTickDeadline<T>(
  work: Promise<T>,
  deadlineMs: number,
  inFlight: () => Iterable<string>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TickDeadlineError(deadlineMs, inFlight()))
    }, deadlineMs)
  })
  void work.catch(() => undefined)
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/**
 * Skip-guard plus deadline. `inProgress.current` is always cleared, including
 * when `work` never settles, so a later call is not skipped forever.
 */
export async function runGuardedTick(options: {
  inProgress: { current: boolean }
  deadlineMs: number
  inFlight: () => Iterable<string>
  work: () => Promise<void>
  onSkip: () => void
  onError: (err: unknown) => void
}): Promise<void> {
  if (options.inProgress.current) {
    options.onSkip()
    return
  }
  options.inProgress.current = true
  try {
    await withTickDeadline(options.work(), options.deadlineMs, options.inFlight)
  } catch (err) {
    options.onError(err)
  } finally {
    options.inProgress.current = false
  }
}
