import assert from "node:assert/strict"
import test from "node:test"
import {
  mapAdyen,
  mapAdyenSeverity,
  type AdyenIncident,
  type AdyenPage,
} from "../src/adyen.js"

function incident(overrides: Partial<AdyenIncident> & { id: string; title: string }): AdyenIncident {
  const { id, ...rest } = overrides
  return {
    sys: { id },
    resolved: false,
    severity: "YELLOW",
    systemAffected: "PLATFORM_AVAILABILITY",
    date: "2026-09-06T10:00:00.000Z",
    ...rest,
  }
}

function operationalPage(overrides: Partial<AdyenPage> = {}): AdyenPage {
  return {
    labels: {
      platformAvailability: "Payments",
      acquirerPaymentsPerformance: "Payment methods and issuers",
    },
    activeIncidents: [],
    recentIncidents: [],
    activeMaintenance: [],
    ...overrides,
  }
}

test("mapAdyenSeverity follows Adyen's grey/yellow/red page colors", () => {
  assert.equal(mapAdyenSeverity("GREY"), "operational")
  assert.equal(mapAdyenSeverity("yellow"), "degraded")
  assert.equal(mapAdyenSeverity("RED"), "partial_outage")
  assert.equal(mapAdyenSeverity("nope"), "unknown")
  assert.equal(mapAdyenSeverity(undefined), "unknown")
})

test("mapAdyen is operational with six systems when nothing is open", () => {
  const state = mapAdyen(
    operationalPage({
      recentIncidents: [
        incident({
          id: "old",
          title: "Twint is experiencing higher error rates",
          resolved: true,
          severity: "GREY",
          systemAffected: "ACQUIRER_PAYMENTS_PERFORMANCE",
          incidentStatusCollection: {
            items: [
              { status: "IDENTIFIED", date: "2026-09-03T15:37:17.930Z" },
              { status: "RESOLVED", date: "2026-09-03T15:46:37.028Z" },
            ],
          },
        }),
      ],
    }),
  )

  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 6)
  assert.equal(state.components[0].externalId, "PLATFORM_AVAILABILITY")
  assert.equal(state.components[0].name, "Payments")
  assert.equal(state.components[0].status, "operational")
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].status, "resolved")
  assert.equal(state.incidents[0].resolvedAt, "2026-09-03T15:46:37.028Z")
  assert.deepEqual(state.detail.source, "adyen")
})

test("mapAdyen paints yellow/red incidents and leaves GREY off the card", () => {
  const state = mapAdyen(
    operationalPage({
      activeIncidents: [
        incident({
          id: "grey-notice",
          title: "Lloyds Bank is experiencing higher error rates",
          severity: "GREY",
          systemAffected: "ACQUIRER_PAYMENTS_PERFORMANCE",
        }),
        incident({
          id: "yellow",
          title: "Intermittently degraded performance in North America",
          severity: "YELLOW",
          systemAffected: "PLATFORM_AVAILABILITY",
          incidentStatusCollection: { items: [{ status: "IDENTIFIED" }] },
        }),
      ],
    }),
  )

  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "Intermittently degraded performance in North America")
  assert.equal(state.components[0].status, "degraded")
  assert.equal(state.components[1].status, "operational")
  assert.equal(state.incidents.length, 2)
})

test("mapAdyen lists upcoming maintenance without painting the card", () => {
  const state = mapAdyen(
    operationalPage({
      activeMaintenance: [
        {
          sys: { id: "maint-1" },
          title: "Scheduled Maintenance on Tokenization services on September 30, 2026",
          date: "2026-08-31T11:28:52.221Z",
          endDate: "2026-09-30T00:00:00.000Z",
          resolved: false,
        },
      ],
    }),
  )

  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].status, "maintenance")
  assert.equal(state.incidents[0].url, "https://status.adyen.com/maintenance-messages")
})
