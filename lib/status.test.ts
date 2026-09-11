import assert from "node:assert/strict"
import { test } from "node:test"

import { formatCardUpdatedAt } from "./status.ts"

const T0 = Date.parse("2026-09-11T12:00:00.000Z")

function isoBefore(ms: number) {
  return new Date(T0 - ms).toISOString()
}

test("card footer stamp is Checked + relative age", () => {
  assert.equal(formatCardUpdatedAt(isoBefore(0), T0), "Checked just now")
  assert.equal(formatCardUpdatedAt(isoBefore(2 * 60_000), T0), "Checked 2m ago")
  assert.equal(formatCardUpdatedAt(isoBefore(60 * 60_000), T0), "Checked 1h ago")
  assert.equal(
    formatCardUpdatedAt(isoBefore(2 * 24 * 60 * 60_000), T0),
    "Checked 2d ago"
  )
})
