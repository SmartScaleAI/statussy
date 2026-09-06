import assert from "node:assert/strict"
import test from "node:test"
import {
  GITLAB_STATUS_PAGE,
  mapGitlab,
  mapStatusIoCode,
  type StatusIoPayload,
} from "../src/gitlab.js"

test("mapStatusIoCode covers Status.io component and overall codes", () => {
  assert.equal(mapStatusIoCode(100), "operational")
  assert.equal(mapStatusIoCode(200), "maintenance")
  assert.equal(mapStatusIoCode(300), "degraded")
  assert.equal(mapStatusIoCode(400), "partial_outage")
  assert.equal(mapStatusIoCode(500), "major_outage")
  assert.equal(mapStatusIoCode(600), "major_outage")
  assert.equal(mapStatusIoCode(undefined, "Degraded Performance"), "degraded")
  assert.equal(mapStatusIoCode(undefined, "Partial Service Disruption"), "partial_outage")
  assert.equal(mapStatusIoCode(999, "something-new"), "unknown")
})

test("mapGitlab is operational when every component is 100", () => {
  const state = mapGitlab({
    result: {
      status_overall: { status: "Operational", status_code: 100 },
      status: [
        { id: "api", name: "API", status: "Operational", status_code: 100 },
        { id: "git", name: "Git Operations", status: "Operational", status_code: 100 },
      ],
      incidents: [],
      maintenance: { active: [], upcoming: [] },
    },
  })
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.source, "status_io")
  assert.equal(state.components.length, 2)
})

test("mapGitlab uses the worst component plus an open incident title", () => {
  const payload: StatusIoPayload = {
    result: {
      status_overall: { status: "Partial Service Disruption", status_code: 400 },
      status: [
        { id: "api", name: "API", status: "Operational", status_code: 100 },
        { id: "ci", name: "CI/CD", status: "Partial Service Disruption", status_code: 400 },
      ],
      incidents: [
        {
          _id: "inc-1",
          name: "CI runners unavailable",
          datetime_open: "2026-09-05T01:00:00.000Z",
          current_status: "Partial Service Disruption",
          current_state: "Investigating",
          messages: [{ details: "Looking into runner capacity", state: 100 }],
        },
        {
          _id: "inc-old",
          name: "Resolved earlier",
          datetime_open: "2026-09-01T00:00:00.000Z",
          datetime_resolved: "2026-09-01T02:00:00.000Z",
          current_state: "Resolved",
          messages: [{ state: 400 }],
        },
      ],
      maintenance: { active: [], upcoming: [] },
    },
  }
  const state = mapGitlab(payload)
  assert.equal(state.status, "partial_outage")
  assert.equal(state.incidentTitle, "CI runners unavailable")
  assert.equal(state.incidents[0]?.status, "investigating")
  assert.equal(
    state.incidents[0]?.url,
    `${GITLAB_STATUS_PAGE}/pages/incident/5b36dc6502d06804c08349f7/inc-1`,
  )
  assert.equal(state.incidents[1]?.status, "resolved")
})

test("mapGitlab paints active maintenance and ignores upcoming windows", () => {
  const upcomingOnly = mapGitlab({
    result: {
      status_overall: { status: "Operational", status_code: 100 },
      status: [{ id: "api", name: "API", status: "Operational", status_code: 100 }],
      incidents: [],
      maintenance: {
        active: [],
        upcoming: [{ _id: "later", name: "Later" }],
      },
    },
  })
  assert.equal(upcomingOnly.status, "operational")
  assert.equal(upcomingOnly.incidentTitle, null)

  const live = mapGitlab({
    result: {
      status_overall: { status: "Operational", status_code: 100 },
      status: [{ id: "api", name: "API", status: "Operational", status_code: 100 }],
      incidents: [],
      maintenance: {
        active: [
          {
            _id: "now",
            name: "Gitaly storage window",
            datetime_planned_start: "2026-09-05T02:00:00.000Z",
          },
        ],
        upcoming: [],
      },
    },
  })
  assert.equal(live.status, "maintenance")
  assert.equal(live.incidentTitle, "Gitaly storage window")
})
