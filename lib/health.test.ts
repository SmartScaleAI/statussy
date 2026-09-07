import assert from "node:assert/strict"
import { test } from "node:test"

import {
  describeChicklet,
  formatHealth,
  resolveHealthChicklet,
} from "./health.ts"

test("component rows present → Health % from operational / total", () => {
  const mistral = resolveHealthChicklet("partial_outage", 16, 17, 3)
  assert.deepEqual(mistral, { kind: "health", operational: 16, total: 17 })
  const display = describeChicklet(mistral)
  assert.equal(display.label, "Health")
  assert.equal(display.value, "94.1%")
  assert.ok(display.title.startsWith("Component health"))
  assert.ok(Math.abs((display.healthPct ?? 0) - (16 / 17) * 100) < 1e-9)

  const allGreen = resolveHealthChicklet("operational", 17, 17, 0)
  assert.deepEqual(allGreen, { kind: "health", operational: 17, total: 17 })
  assert.equal(describeChicklet(allGreen).value, "100.00%")
})

test("no components + none open → No incidents (never a fake 100%)", () => {
  const quiet = resolveHealthChicklet("operational", 0, 0, 0)
  assert.deepEqual(quiet, { kind: "clear" })
  const display = describeChicklet(quiet)
  assert.equal(display.label, null)
  assert.equal(display.value, "No incidents")
  assert.equal(display.healthPct, null)
  assert.ok(!display.title.toLowerCase().includes("component health"))
})

test("no components + open incidents → N incidents (never a fake 0%)", () => {
  const twoOpen = resolveHealthChicklet("partial_outage", 0, 0, 2)
  assert.deepEqual(twoOpen, {
    kind: "incidents",
    count: 2,
    countedIncidents: true,
  })
  const display = describeChicklet(twoOpen)
  assert.equal(display.label, null)
  assert.equal(display.value, "2 incidents")
  assert.equal(display.healthPct, null)
  assert.ok(display.title.includes("2 open incidents"))
  assert.ok(!display.title.toLowerCase().includes("component health"))

  const oneOpen = describeChicklet(resolveHealthChicklet("degraded", 0, 0, 1))
  assert.equal(oneOpen.value, "1 incident")
  assert.ok(oneOpen.title.includes("1 open incident"))
})

test("status-only signal without incident rows → open-events copy", () => {
  // Some feeds signal a problem without parseable incident rows; "No
  // incidents" would be dishonest and "1 incident" would mislabel.
  const signaled = resolveHealthChicklet("major_outage", 0, 0, 0)
  assert.deepEqual(signaled, {
    kind: "incidents",
    count: 1,
    countedIncidents: false,
  })
  const display = describeChicklet(signaled)
  assert.equal(display.label, null)
  assert.equal(display.value, "1 open event")
  assert.ok(!display.title.toLowerCase().includes("component health"))
  assert.ok(!display.value.includes("incident"))
})

test("unknown status with no data stays in No incidents mode", () => {
  // Failed-first-fetch marker: the card already says Unknown; the chicklet
  // must not fake Health 0%.
  const unknown = resolveHealthChicklet("unknown", 0, 0, 0)
  assert.deepEqual(unknown, { kind: "clear" })
})

test("formatHealth precision", () => {
  assert.equal(formatHealth(16, 17), "94.1%")
  assert.equal(formatHealth(17, 17), "100.00%")
  assert.equal(formatHealth(0, 1), "0.0%")
})
