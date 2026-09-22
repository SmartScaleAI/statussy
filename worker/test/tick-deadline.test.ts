import assert from "node:assert/strict"
import { test } from "node:test"

import {
  TICK_DEADLINE_SLACK_MS,
  TICK_FANOUT_FLOOR_MS,
  TickDeadlineError,
  runGuardedTick,
  tickDeadlineMs,
  withTickDeadline,
} from "../src/tick-deadline.js"

test("deadline sits just inside the default refresh interval", () => {
  assert.equal(tickDeadlineMs(300), 300_000 - TICK_DEADLINE_SLACK_MS)
  assert.ok(tickDeadlineMs(300) > TICK_FANOUT_FLOOR_MS)
})

test("short intervals keep the fan-out floor", () => {
  assert.equal(tickDeadlineMs(60), TICK_FANOUT_FLOOR_MS)
  assert.equal(tickDeadlineMs(1), TICK_FANOUT_FLOOR_MS)
})

test("deadline rejects and names in-flight service ids", async () => {
  const inFlight = new Set(["openai", "anthropic"])
  await assert.rejects(
    () => withTickDeadline(new Promise(() => {}), 20, () => inFlight),
    (err: unknown) => {
      assert.ok(err instanceof TickDeadlineError)
      assert.deepEqual(err.inFlight, ["anthropic", "openai"])
      assert.match(err.message, /in-flight \(2\): anthropic, openai/)
      return true
    },
  )
})

test("deadline reports none when no fetch slot is in flight", async () => {
  await assert.rejects(
    () => withTickDeadline(new Promise(() => {}), 20, () => []),
    (err: unknown) => {
      assert.ok(err instanceof TickDeadlineError)
      assert.deepEqual(err.inFlight, [])
      assert.match(err.message, /in-flight \(0\): none/)
      return true
    },
  )
})

test("work that finishes inside the deadline resolves", async () => {
  const value = await withTickDeadline(
    Promise.resolve(7),
    500,
    () => ["openai"],
  )
  assert.equal(value, 7)
})

test("a hung tick clears the guard so the next interval runs", async () => {
  const guard = { current: false }
  const inFlight = new Set(["openai"])
  let failed = 0
  await runGuardedTick({
    inProgress: guard,
    deadlineMs: 20,
    inFlight: () => inFlight,
    work: () => new Promise(() => {}),
    onSkip: () => {
      throw new Error("first interval should run")
    },
    onError: (err) => {
      failed += 1
      assert.ok(err instanceof TickDeadlineError)
      assert.deepEqual(err.inFlight, ["openai"])
    },
  })
  assert.equal(guard.current, false)
  assert.equal(failed, 1)

  let ran = 0
  await runGuardedTick({
    inProgress: guard,
    deadlineMs: 500,
    inFlight: () => [],
    work: async () => {
      ran += 1
    },
    onSkip: () => {
      throw new Error("next interval was skipped")
    },
    onError: (err) => {
      throw err
    },
  })
  assert.equal(ran, 1)
  assert.equal(guard.current, false)
})

test("an in-progress tick is skipped and does not clear the guard", async () => {
  const guard = { current: true }
  let skipped = 0
  let ran = 0
  await runGuardedTick({
    inProgress: guard,
    deadlineMs: 500,
    inFlight: () => [],
    work: async () => {
      ran += 1
    },
    onSkip: () => {
      skipped += 1
    },
    onError: () => {
      throw new Error("skip path should not fail the tick")
    },
  })
  assert.equal(skipped, 1)
  assert.equal(ran, 0)
  assert.equal(guard.current, true)
})
