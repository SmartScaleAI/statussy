import assert from "node:assert/strict"
import test from "node:test"
import {
  flattenFathomMonitors,
  mapFathomJson,
  mapFathomMonitorStatus,
  mapFathomSummarizedStatus,
} from "../src/fathom.js"

test("mapFathomMonitorStatus covers monitor states", () => {
  assert.equal(mapFathomMonitorStatus("up"), "operational")
  assert.equal(mapFathomMonitorStatus("degraded"), "degraded")
  assert.equal(mapFathomMonitorStatus("down"), "major_outage")
  assert.equal(mapFathomMonitorStatus("maintenance"), "maintenance")
  assert.equal(mapFathomMonitorStatus("nope"), "unknown")
})

test("mapFathomSummarizedStatus covers page rollups", () => {
  assert.equal(mapFathomSummarizedStatus("up"), "operational")
  assert.equal(mapFathomSummarizedStatus("mixed"), "degraded")
  assert.equal(mapFathomSummarizedStatus("down"), "major_outage")
})

test("flattenFathomMonitors reads ungrouped + named groups", () => {
  const monitors = flattenFathomMonitors({
    ungrouped: [{ label: "Dashboard", url: "https://app.usefathom.com", status: "up" }],
    Edge: [{ label: "Ingest", url: "https://cdn.usefathom.com", status: "up" }],
  })
  assert.equal(monitors.length, 2)
  assert.equal(monitors[0].label, "Dashboard")
  assert.equal(monitors[1].label, "Ingest")
})

test("mapFathomJson parses the live-shaped operational payload", () => {
  const state = mapFathomJson({
    title: "Fathom Analytics",
    timezone: "UTC",
    summarizedStatus: "up",
    monitors: {
      ungrouped: [
        { label: "Dashboard", url: "https://app.usefathom.com", status: "up" },
        { label: "Ingest", url: "https://cdn.usefathom.com", status: "up" },
      ],
    },
  })
  assert.equal(state.status, "operational")
  assert.equal(state.detail.source, "fathom")
  assert.equal(state.components.length, 2)
  assert.equal(state.components[0].name, "Dashboard")
  assert.equal(state.components[1].name, "Ingest")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
})

test("mapFathomJson degrades when a monitor is down", () => {
  const state = mapFathomJson({
    summarizedStatus: "up",
    pinnedUpdate: { title: "Ingest errors" },
    monitors: {
      ungrouped: [
        { label: "Dashboard", status: "up" },
        { label: "Ingest", status: "down" },
      ],
    },
  })
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Ingest errors")
})
