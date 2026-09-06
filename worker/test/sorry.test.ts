import assert from "node:assert/strict"
import test from "node:test"
import {
  fetchSorryState,
  isSorryNoticeOpen,
  mapSorry,
  mapSorryState,
  type SorryComponent,
  type SorryNotice,
  type SorryStatus,
} from "../src/sorry.js"

const status: SorryStatus = {
  page: {
    id: 2754,
    name: "Pipedrive Status",
    state: "operational",
    updated_at: "2026-09-06T12:07:00.290Z",
    url: "https://status.pipedrive.com",
  },
}

const components: SorryComponent[] = [
  { id: 7277, name: "Application", state: "operational", position: 1 },
  { id: 2530, name: "Web App", state: "operational", parent_id: 7277, position: 3 },
  { id: 2536, name: "Email Sync", state: "recovering", position: 10 },
]

const recovering: SorryNotice = {
  id: 508666,
  type: "unplanned",
  state: "recovering",
  timeline_state: "present",
  subject: "Email Integration Issue",
  url: "https://status.pipedrive.com/notices/email",
  began_at: "2026-09-04T11:39:42.913Z",
  ended_at: null,
}

const investigating: SorryNotice = {
  id: 508700,
  type: "unplanned",
  state: "investigating",
  subject: "Web App latency",
  began_at: "2026-09-06T10:00:00.000Z",
  ended_at: null,
}

const resolved: SorryNotice = {
  id: 508417,
  type: "unplanned",
  state: "resolved",
  subject: "Invoice Integration Issue",
  began_at: "2026-09-01T21:37:04.286Z",
  ended_at: "2026-09-02T07:33:11.536Z",
}

test("mapSorryState covers Sorry page and notice states", () => {
  assert.equal(mapSorryState("operational"), "operational")
  assert.equal(mapSorryState("degraded"), "degraded")
  assert.equal(mapSorryState("partial-outage"), "partial_outage")
  assert.equal(mapSorryState("major_outage"), "major_outage")
  assert.equal(mapSorryState("under-maintenance"), "maintenance")
  assert.equal(mapSorryState("recovering"), "degraded")
  assert.equal(mapSorryState("resolved"), "operational")
})

test("isSorryNoticeOpen treats recovering as not current", () => {
  assert.equal(isSorryNoticeOpen(recovering), false)
  assert.equal(isSorryNoticeOpen(investigating), true)
  assert.equal(isSorryNoticeOpen(resolved), false)
})

test("mapSorry stays operational when the only notice is recovering", () => {
  const state = mapSorry(
    { status, components, notices: [recovering, resolved] },
    "https://status.pipedrive.com",
  )
  assert.equal(state.detail.source, "sorry")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 2)
  assert.equal(state.incidents[0].status, "recovering")
  assert.equal(state.incidents[0].resolvedAt, null)
  const email = state.components.find((component) => component.name === "Email Sync")
  assert.equal(email?.status, "degraded")
})

test("mapSorry paints an investigating notice and the page state", () => {
  const state = mapSorry(
    {
      status: { page: { ...status.page, state: "degraded" } },
      components,
      notices: [investigating, recovering],
    },
    "https://status.pipedrive.com",
  )
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "Web App latency")
  assert.equal(state.incidents[0].resolvedAt, null)
})

test("fetchSorryState follows component pagination", async () => {
  const responses = new Map<string, unknown>([
    [
      "https://status.pipedrive.com/api/v1/status",
      { page: status.page },
    ],
    [
      "https://status.pipedrive.com/api/v1/components",
      {
        components: [components[0]],
        meta: { next_page: "/api/v1/components?page=2", total_count: 2 },
      },
    ],
    [
      "https://status.pipedrive.com/api/v1/components?page=2",
      { components: [components[1]], meta: { next_page: null } },
    ],
    [
      "https://status.pipedrive.com/api/v1/notices",
      { notices: [recovering], meta: { next_page: null } },
    ],
  ])

  const state = await fetchSorryState("https://status.pipedrive.com", {
    timeoutMs: 1000,
    userAgent: "statussy-test",
    fetchImpl: async (input) => {
      const url = String(input)
      const body = responses.get(url)
      if (!body) return new Response("missing", { status: 404 })
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    },
  })

  assert.equal(state.components.length, 2)
  assert.equal(state.components[0].name, "Application")
  assert.equal(state.components[1].name, "Web App")
  assert.equal(state.status, "operational")
})
