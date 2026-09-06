import assert from "node:assert/strict"
import test from "node:test"
import { mapOpenstatus, type OpenstatusSummary } from "../src/openstatus.js"

const TRAEFIK_LIKE: OpenstatusSummary = {
  page: {
    name: "Traefik Status",
    url: "https://status.traefik.io",
    updated_at: "2026-04-03T08:15:47.000Z",
  },
  status: { indicator: "minor", description: "Partial System Outage" },
  components: [
    { name: "Hub API", status: "operational" },
    { name: "Hub SSO", status: "degraded_performance" },
    { name: "Plugin Catalog", status: "operational" },
    { name: "", status: "operational" },
  ],
  incidents: [
    {
      id: "hub-sso",
      name: "Hub SSO latency",
      status: "investigating",
      impact: "minor",
      started_at: "2026-09-06T10:00:00Z",
    },
    {
      name: "Docs blip",
      status: "resolved",
      resolved_at: "2026-09-05T12:00:00Z",
    },
  ],
  scheduled_maintenances: [
    {
      id: "maint-1",
      title: "Hub API window",
      status: "in_progress",
      started_at: "2026-09-06T11:00:00Z",
    },
  ],
}

test("mapOpenstatus uses names as ids and ignores the page rollup for components", () => {
  const state = mapOpenstatus(TRAEFIK_LIKE, "https://status.traefik.io/")
  assert.equal(state.status, "degraded")
  assert.equal(state.detail.source, "openstatus")
  assert.equal(state.detail.indicator, "minor")
  assert.equal(state.detail.pageUpdatedAt, "2026-04-03T08:15:47.000Z")
  assert.equal(state.incidentTitle, "Hub SSO latency")
  assert.deepEqual(
    state.components.map((component) => [component.externalId, component.name, component.status]),
    [
      ["Hub API", "Hub API", "operational"],
      ["Hub SSO", "Hub SSO", "degraded"],
      ["Plugin Catalog", "Plugin Catalog", "operational"],
    ],
  )
  assert.equal(state.incidents.length, 3)
  assert.equal(state.incidents[0].url, "https://status.traefik.io/incidents/hub-sso")
  assert.equal(state.incidents[1].externalId, "Docs blip")
  assert.equal(state.incidents[2].status, "in_progress")
  assert.equal(state.incidents[2].title, "Hub API window")
})

test("mapOpenstatus handles an all-operational page with no incidents", () => {
  const state = mapOpenstatus(
    {
      page: { name: "Traefik Status" },
      status: { indicator: "none", description: "All Systems Operational" },
      components: [{ name: "Hub API", status: "operational" }],
      incidents: [],
    },
    "https://status.traefik.io",
  )
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.components.length, 1)
})
