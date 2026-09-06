import assert from "node:assert/strict"
import test from "node:test"
import {
  collapseAlgoliaIncidents,
  mapAlgolia,
  mapAlgoliaClusterStatus,
} from "../src/algolia.js"

test("mapAlgoliaClusterStatus covers Algolia cluster labels", () => {
  assert.equal(mapAlgoliaClusterStatus("operational"), "operational")
  assert.equal(mapAlgoliaClusterStatus("degraded"), "degraded")
  assert.equal(mapAlgoliaClusterStatus("major_outage"), "major_outage")
  assert.equal(mapAlgoliaClusterStatus("maintenance"), "maintenance")
  assert.equal(mapAlgoliaClusterStatus("something_new"), "unknown")
})

test("mapAlgolia is operational when every cluster is operational", () => {
  const state = mapAlgolia(
    { status: { "c1-br": "operational", "c1-usw": "operational" } },
    { incidents: {} },
  )
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 2)
  assert.equal(state.detail.source, "algolia")
  assert.equal(state.detail.clusterCount, 2)
  assert.equal(state.detail.nonOperationalCount, 0)
})

test("mapAlgolia overall is any non-operational cluster", () => {
  const state = mapAlgolia(
    {
      status: {
        "c1-br": "operational",
        "c23-usw": "major_outage",
        "c3-br": "degraded",
      },
    },
    {
      incidents: {
        "c23-usw": [
          {
            t: 1_787_245_333_000,
            v: {
              title: "Incident on cluster c23-usw: We are encountering a major issue.",
              status: "major_outage",
            },
          },
        ],
      },
    },
  )
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Incident on cluster c23-usw: We are encountering a major issue.")
  assert.equal(state.components.find((component) => component.name === "c23-usw")?.status, "major_outage")
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].status, "major_outage")
  assert.equal(state.incidents[0].resolvedAt, null)
})

test("collapseAlgoliaIncidents pairs an outage with the later recovery", () => {
  const collapsed = collapseAlgoliaIncidents({
    "c23-usw": [
      {
        t: 1_787_245_456_000,
        v: { title: "Incident on cluster c23-usw: Everything operating normally.", status: "operational" },
      },
      {
        t: 1_787_245_333_000,
        v: { title: "Incident on cluster c23-usw: We are encountering a major issue.", status: "major_outage" },
      },
    ],
  })
  assert.equal(collapsed.length, 1)
  assert.equal(collapsed[0].resolvedAt, 1_787_245_456_000)
  assert.equal(collapsed[0].status, "major_outage")

  const state = mapAlgolia(
    { status: { "c23-usw": "operational" } },
    {
      incidents: {
        "c23-usw": [
          {
            t: 1_787_245_333_000,
            v: { title: "Incident on cluster c23-usw: We are encountering a major issue.", status: "major_outage" },
          },
          {
            t: 1_787_245_456_000,
            v: { title: "Incident on cluster c23-usw: Everything operating normally.", status: "operational" },
          },
        ],
      },
    },
  )
  assert.equal(state.status, "operational")
  assert.equal(state.incidents[0].status, "resolved")
  assert.equal(state.incidents[0].resolvedAt, new Date(1_787_245_456_000).toISOString())
})
