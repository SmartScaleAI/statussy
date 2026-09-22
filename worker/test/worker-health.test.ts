import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isWorkerTickFresh,
  workerHealthStatus,
  workerStaleAfterMs,
} from "../src/worker-health.js"

const T0 = Date.parse("2026-09-22T00:00:00.000Z")

test("freshness window is three refresh intervals (15m at the default cadence)", () => {
  assert.equal(workerStaleAfterMs(300), 15 * 60 * 1000)
  assert.equal(workerStaleAfterMs(10), 30_000)
})

test("no successful tick stays healthy through the window and the boot grace", () => {
  const staleAfterMs = workerStaleAfterMs(300)
  assert.equal(
    isWorkerTickFresh({
      startedAtMs: T0,
      lastSuccessfulTickAtMs: null,
      now: T0 + staleAfterMs,
      staleAfterMs,
    }),
    true,
  )
  assert.equal(
    isWorkerTickFresh({
      startedAtMs: T0,
      lastSuccessfulTickAtMs: null,
      now: T0 + staleAfterMs + 1,
      staleAfterMs,
    }),
    false,
  )
  assert.equal(
    isWorkerTickFresh({
      startedAtMs: T0,
      lastSuccessfulTickAtMs: null,
      now: T0 + staleAfterMs + 1,
      staleAfterMs,
      startupGraceMs: staleAfterMs + 10_000,
    }),
    true,
  )
})

test("health fails when the last successful tick is past the freshness window", () => {
  const staleAfterMs = workerStaleAfterMs(300)
  const base = {
    startedAtMs: T0 - 60 * 60 * 1000,
    staleAfterMs,
  }
  assert.equal(
    isWorkerTickFresh({
      ...base,
      lastSuccessfulTickAtMs: T0,
      now: T0 + staleAfterMs,
    }),
    true,
  )
  assert.equal(
    isWorkerTickFresh({
      ...base,
      lastSuccessfulTickAtMs: T0,
      now: T0 + staleAfterMs + 1,
    }),
    false,
  )

  const fresh = workerHealthStatus({
    startedAtMs: base.startedAtMs,
    lastSuccessfulTickAtMs: T0,
    now: T0 + 60_000,
    refreshIntervalSeconds: 300,
  })
  assert.deepEqual(fresh, {
    httpStatus: 200,
    status: "ok",
    staleAfterSeconds: 900,
  })

  const stale = workerHealthStatus({
    startedAtMs: base.startedAtMs,
    lastSuccessfulTickAtMs: T0,
    now: T0 + staleAfterMs + 1,
    refreshIntervalSeconds: 300,
  })
  assert.equal(stale.httpStatus, 503)
  assert.equal(stale.status, "stale")
  assert.equal(stale.staleAfterSeconds, 900)
})
