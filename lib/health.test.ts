import assert from "node:assert/strict"
import { test } from "node:test"

import { formatHealth, resolveLiveHealth } from "./health.ts"

test("Health uses operational / total current components", () => {
  const mistral = resolveLiveHealth("partial_outage", 16, 17)
  assert.deepEqual(mistral, { operational: 16, total: 17 })
  assert.equal(formatHealth(mistral.operational, mistral.total), "94.1%")

  const allGreen = resolveLiveHealth("operational", 17, 17)
  assert.deepEqual(allGreen, { operational: 17, total: 17 })
  assert.equal(formatHealth(allGreen.operational, allGreen.total), "100.00%")
})

test("Health fallback when a provider has no components", () => {
  const operational = resolveLiveHealth("operational", 0, 0)
  assert.deepEqual(operational, { operational: 1, total: 1 })
  assert.equal(formatHealth(operational.operational, operational.total), "100.00%")

  const partial = resolveLiveHealth("partial_outage", 0, 0)
  assert.deepEqual(partial, { operational: 0, total: 1 })
  assert.equal(formatHealth(partial.operational, partial.total), "0.0%")
})
