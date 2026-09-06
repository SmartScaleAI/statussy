import assert from "node:assert/strict"
import test from "node:test"
import {
  mapIncidentioImpact,
  mapIncidentioSummary,
  type IncidentioSummary,
} from "../src/incidentio.js"

test("mapIncidentioImpact covers incident.io impacts", () => {
  assert.equal(mapIncidentioImpact("none"), "operational")
  assert.equal(mapIncidentioImpact("minor"), "degraded")
  assert.equal(mapIncidentioImpact("major"), "partial_outage")
  assert.equal(mapIncidentioImpact("critical"), "major_outage")
  assert.equal(mapIncidentioImpact("maintenance"), "maintenance")
  assert.equal(mapIncidentioImpact("bogus"), "unknown")
})

test("mapIncidentioSummary is operational with empty PostHog-shaped payload", () => {
  const summary: IncidentioSummary = {
    page_title: "PostHog",
    page_url: "https://www.posthogstatus.com/",
    ongoing_incidents: [],
    in_progress_maintenances: [],
    scheduled_maintenances: [],
  }
  const state = mapIncidentioSummary(summary, "https://www.posthogstatus.com")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.detail.source, "incidentio")
})

test("mapIncidentioSummary uses ongoing incidents for overall + headline", () => {
  const summary: IncidentioSummary = {
    page_title: "PostHog",
    ongoing_incidents: [
      {
        id: "inc_1",
        name: "Ingest delays",
        status: "investigating",
        impact: "major",
        url: "https://www.posthogstatus.com/incidents/inc_1",
        started_at: "2026-09-06T11:00:00Z",
      },
    ],
    in_progress_maintenances: [],
    scheduled_maintenances: [
      {
        id: "mnt_1",
        name: "Scheduled window",
        status: "scheduled",
        started_at: "2026-09-07T00:00:00Z",
      },
    ],
  }
  const state = mapIncidentioSummary(summary, "https://www.posthogstatus.com")
  assert.equal(state.status, "partial_outage")
  assert.equal(state.incidentTitle, "Ingest delays")
  assert.equal(state.incidents.length, 2)
  assert.equal(state.incidents[0].status, "investigating")
  assert.equal(state.incidents[1].status, "scheduled")
})

test("mapIncidentioSummary paints maintenance when only in-progress work exists", () => {
  const state = mapIncidentioSummary(
    {
      in_progress_maintenances: [
        { id: "mnt_2", name: "DB failover", status: "in_progress", started_at: "2026-09-06T10:00:00Z" },
      ],
    },
    "https://www.posthogstatus.com",
  )
  assert.equal(state.status, "maintenance")
  assert.equal(state.incidentTitle, "DB failover")
})
