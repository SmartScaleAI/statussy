import assert from "node:assert/strict"
import test from "node:test"
import {
  mapChecklyCheckStatus,
  mapChecklyClient,
  mapChecklyImpact,
  type ChecklyCheck,
  type ChecklyClientIncident,
} from "../src/checkly-client.js"

test("mapChecklyCheckStatus covers Checkly check flags", () => {
  assert.equal(mapChecklyCheckStatus({ hasFailures: false, isDegraded: false }), "operational")
  assert.equal(mapChecklyCheckStatus({ hasFailures: true, isDegraded: false }), "major_outage")
  assert.equal(mapChecklyCheckStatus({ hasFailures: false, hasErrors: true }), "major_outage")
  assert.equal(mapChecklyCheckStatus({ hasFailures: false, isDegraded: true }), "degraded")
  assert.equal(mapChecklyCheckStatus(undefined), "unknown")
})

test("mapChecklyImpact covers Checkly incident impacts", () => {
  assert.equal(mapChecklyImpact("MINOR"), "degraded")
  assert.equal(mapChecklyImpact("MAJOR"), "partial_outage")
  assert.equal(mapChecklyImpact("CRITICAL"), "major_outage")
  assert.equal(mapChecklyImpact("MAINTENANCE"), "maintenance")
  assert.equal(mapChecklyImpact(undefined), "unknown")
})

const checks: ChecklyCheck[] = [
  {
    id: "cdn-us",
    name: "Lottie CDN (US)",
    activated: true,
    status: { hasFailures: false, isDegraded: false },
  },
  {
    id: "auth",
    name: "Platform - Authentication",
    activated: true,
    status: { hasFailures: false, isDegraded: false },
  },
]

test("mapChecklyClient is operational when checks pass and incidents are resolved", () => {
  const incidents: ChecklyClientIncident[] = [
    {
      id: "inc-1",
      name: "Security Incident Notice",
      impact: "MINOR",
      startedAt: "2026-06-20T14:57:12.095Z",
      stoppedAt: "2026-08-20T05:50:54.504Z",
    },
  ]
  const state = mapChecklyClient(checks, incidents)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.source, "checkly_client")
  assert.equal(state.components.length, 2)
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0]?.status, "resolved")
  assert.notEqual(state.detail.source, "checkly_nuxt")
})

test("mapChecklyClient paints failing checks and open incidents", () => {
  const failing: ChecklyCheck[] = [
    checks[0],
    {
      id: "auth",
      name: "Platform - Authentication",
      activated: true,
      status: { hasFailures: true, isDegraded: false },
    },
  ]
  const incidents: ChecklyClientIncident[] = [
    {
      id: "inc-open",
      name: "Auth errors elevated",
      impact: "MAJOR",
      startedAt: "2026-09-06T12:00:00.000Z",
      stoppedAt: null,
      incidentUpdates: [{ status: "IDENTIFIED" }],
    },
  ]
  const state = mapChecklyClient(failing, incidents, {
    pageUrl: "https://status.lottiefiles.com",
  })
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Auth errors elevated")
  assert.equal(state.incidents[0]?.url, "https://status.lottiefiles.com/incidents/inc-open")
  assert.equal(state.incidents[0]?.status, "identified")
  assert.equal(
    state.components.find((component) => component.externalId === "auth")?.status,
    "major_outage",
  )
})

test("mapChecklyClient throws when no activated checks remain", () => {
  assert.throws(
    () => mapChecklyClient([{ id: "x", name: "Off", activated: false }], []),
    /no activated checks/,
  )
})
