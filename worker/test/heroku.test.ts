import assert from "node:assert/strict"
import test from "node:test"
import { mapHeroku, mapHerokuColor, type HerokuCurrentStatus } from "../src/heroku.js"

test("mapHerokuColor covers Heroku system colors", () => {
  assert.equal(mapHerokuColor("green"), "operational")
  assert.equal(mapHerokuColor("YELLOW"), "degraded")
  assert.equal(mapHerokuColor("orange"), "partial_outage")
  assert.equal(mapHerokuColor("red"), "major_outage")
  assert.equal(mapHerokuColor("blue"), "maintenance")
  assert.equal(mapHerokuColor("nope"), "unknown")
  assert.equal(mapHerokuColor(undefined), "unknown")
})

test("mapHeroku is operational when every system is green", () => {
  const payload: HerokuCurrentStatus = {
    status: [
      { system: "Apps", status: "green" },
      { system: "Data", status: "green" },
      { system: "Tools", status: "green" },
    ],
    incidents: [],
    scheduled: [],
  }
  const state = mapHeroku(payload)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 3)
  assert.equal(state.detail.source, "heroku")
})

test("mapHeroku uses the worst system color and an open incident title", () => {
  const payload: HerokuCurrentStatus = {
    status: [
      { system: "Apps", status: "yellow" },
      { system: "Data", status: "red" },
      { system: "Tools", status: "green" },
    ],
    incidents: [
      {
        id: 1924,
        title: "Data service disruption in US",
        created_at: "2026-09-05T01:00:00.000Z",
        resolved: false,
        resolved_at: null,
        full_url: "https://status.heroku.com/incidents/1924",
      },
      {
        id: 1900,
        title: "Resolved tools blip",
        created_at: "2026-08-01T00:00:00.000Z",
        resolved: true,
        resolved_at: "2026-08-01T01:00:00.000Z",
        full_url: "https://status.heroku.com/incidents/1900",
      },
    ],
    scheduled: [],
  }
  const state = mapHeroku(payload)
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Data service disruption in US")
  assert.equal(state.incidents.length, 2)
  assert.equal(state.incidents[0].status, "investigating")
  assert.equal(state.incidents[1].status, "resolved")
  assert.equal(state.incidents[1].resolvedAt, "2026-08-01T01:00:00.000Z")
  assert.equal(
    state.components.find((component) => component.name === "Data")?.status,
    "major_outage",
  )
})
