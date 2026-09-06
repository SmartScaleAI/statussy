import assert from "node:assert/strict"
import test from "node:test"
import { mapSlack, mapSlackType, type SlackCurrent } from "../src/slack.js"

test("mapSlackType covers Slack types and maintenance lifecycle", () => {
  assert.equal(mapSlackType("outage"), "major_outage")
  assert.equal(mapSlackType("incident"), "degraded")
  assert.equal(mapSlackType("notice"), "operational")
  assert.equal(mapSlackType("incident", "scheduled"), "maintenance")
  assert.equal(mapSlackType("outage", "completed"), "operational")
  assert.equal(mapSlackType("nope"), "unknown")
})

test("mapSlack is operational when status is ok and nothing is open", () => {
  const payload: SlackCurrent = {
    status: "ok",
    date_updated: "2026-09-06T00:00:00-07:00",
    active_incidents: [],
  }
  const state = mapSlack(payload)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
  assert.ok(state.components.length >= 8)
  assert.equal(state.detail.source, "slack")
})

test("mapSlack uses the worst open incident and paints affected services", () => {
  const payload: SlackCurrent = {
    status: "active",
    date_updated: "2026-09-06T01:00:00-07:00",
    active_incidents: [
      {
        id: 1576,
        title: "Messaging delays in some workspaces",
        type: "incident",
        status: "active",
        url: "https://slack-status.com/2026-09/abc",
        date_created: "2026-09-06T00:30:00-07:00",
        services: ["Messaging", "Notifications"],
      },
      {
        id: 99,
        title: "Huddles notice",
        type: "notice",
        status: "active",
        services: ["Huddles"],
      },
    ],
  }
  const state = mapSlack(payload)
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "Messaging delays in some workspaces")
  assert.equal(state.incidents.length, 2)
  const messaging = state.components.find((c) => c.name === "Messaging")
  const huddles = state.components.find((c) => c.name === "Huddles")
  assert.equal(messaging?.status, "degraded")
  assert.equal(huddles?.status, "operational")
})

test("mapSlack paints an outage worse than an incident", () => {
  const state = mapSlack({
    status: "active",
    active_incidents: [
      {
        id: 1,
        title: "Search blip",
        type: "incident",
        status: "active",
        services: ["Search"],
      },
      {
        id: 2,
        title: "Login outage",
        type: "outage",
        status: "active",
        services: ["Login/SSO"],
      },
    ],
  })
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Search blip")
})
