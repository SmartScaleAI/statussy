import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  flattenRailwayComponents,
  mapRailway,
  mapRailwayStatus,
  type RailwayStatus,
} from "../src/railway.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

async function loadFixture(): Promise<RailwayStatus> {
  return JSON.parse(await readFile(join(FIXTURES, "railway-status.json"), "utf8"))
}

test("mapRailwayStatus covers Railway component and impact labels", () => {
  assert.equal(mapRailwayStatus("OPERATIONAL"), "operational")
  assert.equal(mapRailwayStatus("DEGRADED"), "degraded")
  assert.equal(mapRailwayStatus("MINOR"), "degraded")
  assert.equal(mapRailwayStatus("PARTIAL_OUTAGE"), "partial_outage")
  assert.equal(mapRailwayStatus("MAJOR"), "partial_outage")
  assert.equal(mapRailwayStatus("CRITICAL"), "major_outage")
  assert.equal(mapRailwayStatus("OUTAGE"), "major_outage")
  assert.equal(mapRailwayStatus("MAINTENANCE"), "maintenance")
  assert.equal(mapRailwayStatus("something_new"), "unknown")
  assert.equal(mapRailwayStatus(undefined), "unknown")
})

test("flattenRailwayComponents walks groups and keeps leaf components", async () => {
  const payload = await loadFixture()
  const leaves = flattenRailwayComponents(payload.components)
  assert.deepEqual(
    leaves.map((component) => component.name),
    ["Dashboard — railway.com", "API — backboard.railway.com", "Payments & Billing"],
  )
})

test("mapRailway uses the worst leaf plus open incidents", async () => {
  const state = mapRailway(await loadFixture())

  assert.equal(state.status, "degraded")
  assert.equal(state.detail.source, "railway")
  assert.equal(state.detail.openIncidentCount, 1)
  assert.equal(state.incidentTitle, "Elevated API latency")
  assert.equal(state.components.length, 3)
  assert.equal(
    state.components.find((component) => component.name.startsWith("API"))?.status,
    "degraded",
  )
  assert.equal(state.incidents.length, 2)
  assert.equal(state.incidents[0].url, "https://status.railway.com/incident/api-latency")
  assert.equal(state.incidents[0].status, "identified")
  assert.equal(state.incidents[1].resolvedAt, "2026-08-01T02:00:00.000Z")
})

test("mapRailway ignores scheduled-but-not-started maintenance", () => {
  const state = mapRailway({
    components: [{ id: "c1", name: "API", status: "OPERATIONAL", type: "component" }],
    incidents: [],
    maintenances: [
      {
        id: "m1",
        slug: "later",
        title: "Later",
        status: "SCHEDULED",
      },
    ],
  })
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
})

test("mapRailway paints in-progress maintenance when otherwise operational", () => {
  const state = mapRailway({
    components: [{ id: "c1", name: "API", status: "OPERATIONAL", type: "component" }],
    incidents: [],
    maintenances: [
      {
        id: "m1",
        slug: "now",
        title: "EU West compute window",
        status: "IN_PROGRESS",
      },
    ],
  })
  assert.equal(state.status, "maintenance")
  assert.equal(state.incidentTitle, "EU West compute window")
})
