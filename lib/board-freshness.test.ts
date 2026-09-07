import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BOARD_STALE_AFTER_MS,
  boardFreshnessTitle,
  formatRelativeAge,
  isBoardStale,
  POLL_INTERVAL_MS,
} from "./board-freshness.ts"

const T0 = Date.parse("2026-09-07T12:00:00.000Z")

function isoBefore(ms: number) {
  return new Date(T0 - ms).toISOString()
}

test("stale threshold = 3 missed 5m poll ticks", () => {
  assert.equal(POLL_INTERVAL_MS, 5 * 60 * 1000)
  assert.equal(BOARD_STALE_AFTER_MS, 3 * POLL_INTERVAL_MS)
})

test("isBoardStale flips only past the threshold", () => {
  assert.equal(isBoardStale(isoBefore(0), T0), false)
  assert.equal(isBoardStale(isoBefore(2 * 60_000), T0), false)
  // At exactly the threshold the board is still considered fresh.
  assert.equal(isBoardStale(isoBefore(BOARD_STALE_AFTER_MS), T0), false)
  assert.equal(isBoardStale(isoBefore(BOARD_STALE_AFTER_MS + 1), T0), true)
  assert.equal(isBoardStale(isoBefore(60 * 60_000), T0), true)
})

test("relative age buckets: just now → m → h → d", () => {
  assert.equal(formatRelativeAge(isoBefore(0), T0), "just now")
  assert.equal(formatRelativeAge(isoBefore(59_000), T0), "just now")
  assert.equal(formatRelativeAge(isoBefore(60_000), T0), "1m ago")
  assert.equal(formatRelativeAge(isoBefore(2 * 60_000 + 30_000), T0), "2m ago")
  assert.equal(formatRelativeAge(isoBefore(59 * 60_000), T0), "59m ago")
  assert.equal(formatRelativeAge(isoBefore(60 * 60_000), T0), "1h ago")
  assert.equal(formatRelativeAge(isoBefore(23 * 60 * 60_000), T0), "23h ago")
  assert.equal(formatRelativeAge(isoBefore(24 * 60 * 60_000), T0), "1d ago")
  assert.equal(
    formatRelativeAge(isoBefore(3 * 24 * 60 * 60_000), T0),
    "3d ago"
  )
})

test("clock skew (future refreshedAt) clamps to just now, never stale", () => {
  const future = new Date(T0 + 90_000).toISOString()
  assert.equal(formatRelativeAge(future, T0), "just now")
  assert.equal(isBoardStale(future, T0), false)
})

test("tooltip carries absolute UTC and the poll cadence", () => {
  const title = boardFreshnessTitle("2026-09-07T12:00:00.000Z")
  assert.ok(title.includes("Sep 7"), title)
  assert.ok(title.includes("12:00"), title)
  assert.ok(title.includes("UTC"), title)
  assert.ok(title.includes("polls about every 5 min"), title)
})
