import assert from "node:assert/strict"
import test from "node:test"
import {
  mapZendesk,
  mapZendeskImpact,
  type ZendeskIncidentAttrs,
  type ZendeskList,
  type ZendeskServiceAttrs,
} from "../src/zendesk.js"

test("mapZendeskImpact covers Zendesk impact + flags", () => {
  assert.equal(mapZendeskImpact("critical"), "major_outage")
  assert.equal(mapZendeskImpact("MAJOR"), "partial_outage")
  assert.equal(mapZendeskImpact("minor"), "degraded")
  assert.equal(mapZendeskImpact("maintenance"), "maintenance")
  assert.equal(mapZendeskImpact("none"), "operational")
  assert.equal(mapZendeskImpact(null, { outage: true }), "major_outage")
  assert.equal(mapZendeskImpact(undefined, { degradation: true }), "degraded")
  assert.equal(mapZendeskImpact("nope"), "unknown")
})

test("mapZendesk is operational when every incident is resolved", () => {
  const services: ZendeskList<ZendeskServiceAttrs> = {
    data: [
      { id: "1", attributes: { name: "Support", position: 10000 } },
      { id: "31", attributes: { name: "Voice", position: 40000 } },
    ],
  }
  const incidents: ZendeskList<ZendeskIncidentAttrs> = {
    data: [
      {
        id: "10240",
        attributes: {
          name: "Issues with Voice calls and call functions",
          impact: "critical",
          status: "resolved",
          outage: true,
          startedAt: "2026-09-01T16:15:00.000Z",
          resolvedAt: "2026-09-01T18:27:03.000Z",
        },
      },
    ],
  }
  const state = mapZendesk(services, incidents)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 2)
  assert.equal(state.incidents[0].status, "resolved")
  assert.equal(state.detail.source, "zendesk")
})

test("mapZendesk uses the worst open incident and paints components", () => {
  const services: ZendeskList<ZendeskServiceAttrs> = {
    data: [
      { id: "1", attributes: { name: "Support", position: 10000 } },
      { id: "31", attributes: { name: "Voice", position: 40000 } },
      { id: "99", attributes: { name: "Legacy", deprecated: true } },
    ],
  }
  const incidents: ZendeskList<ZendeskIncidentAttrs> = {
    data: [
      {
        id: "11000",
        attributes: {
          name: "Voice outage in pod 12",
          impact: "critical",
          status: "investigating",
          outage: true,
          startedAt: "2026-09-06T01:00:00.000Z",
          resolvedAt: null,
        },
      },
      {
        id: "10900",
        attributes: {
          name: "Resolved chat blip",
          impact: "minor",
          status: "resolved",
          startedAt: "2026-08-01T00:00:00.000Z",
          resolvedAt: "2026-08-01T01:00:00.000Z",
        },
      },
    ],
    included: [
      {
        id: "1",
        attributes: { serviceId: 31, outage: true, resolvedAt: null },
      },
    ],
  }
  const state = mapZendesk(services, incidents)
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Voice outage in pod 12")
  assert.equal(state.incidents.length, 2)
  assert.equal(state.incidents[0].status, "investigating")
  assert.equal(state.incidents[1].status, "resolved")
  assert.equal(state.components.find((component) => component.name === "Voice")?.status, "major_outage")
  assert.equal(state.components.find((component) => component.name === "Support")?.status, "operational")
  assert.equal(state.components.some((component) => component.name === "Legacy"), false)
})
