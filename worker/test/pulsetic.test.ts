import assert from "node:assert/strict"
import test from "node:test"
import { mapPulseticMonitorStatus, mapPulseticPage } from "../src/pulsetic.js"

test("mapPulseticMonitorStatus covers monitor states", () => {
  assert.equal(mapPulseticMonitorStatus("online"), "operational")
  assert.equal(mapPulseticMonitorStatus("degraded"), "degraded")
  assert.equal(mapPulseticMonitorStatus("offline"), "major_outage")
  assert.equal(mapPulseticMonitorStatus("maintenance"), "maintenance")
  assert.equal(mapPulseticMonitorStatus("mystery"), "unknown")
})

test("mapPulseticPage parses the Kissmetrics-shaped payload", () => {
  const state = mapPulseticPage(
    {
      id: 9098,
      title: "Kissmetrics Status",
      slug: "UA2xAu7W",
      domain: "status.kissmetrics.io",
      monitors: [
        { id: 19011, name: "Authentication Service", status: "online", order: 0, disabled: 0 },
        { id: 19012, name: "Application Service", status: "online", order: 1, disabled: 0 },
      ],
      incidents: [],
      live_maintenances: [],
    },
    "https://status.kissmetrics.io/",
  )
  assert.equal(state.status, "operational")
  assert.equal(state.detail.source, "pulsetic")
  assert.equal(state.components.length, 2)
  assert.equal(state.components[0].name, "Authentication Service")
  assert.equal(state.components[1].name, "Application Service")
  assert.equal(state.incidentTitle, null)
})

test("mapPulseticPage rolls up a down monitor and open incident", () => {
  const state = mapPulseticPage(
    {
      monitors: [
        { id: 1, name: "Auth", status: "online", order: 0 },
        { id: 2, name: "App", status: "offline", order: 1 },
      ],
      incidents: [
        {
          id: 88,
          title: "App unreachable",
          status: "investigating",
          started_at: "2026-09-06T11:00:00.000000Z",
        },
      ],
    },
    "https://status.kissmetrics.io/",
  )
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "App unreachable")
  assert.equal(state.incidents[0].resolvedAt, null)
})

test("mapPulseticPage throws when monitors are missing", () => {
  assert.throws(() => mapPulseticPage({ monitors: [] }, "https://status.kissmetrics.io/"))
})
