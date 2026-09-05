import assert from "node:assert/strict"
import test from "node:test"
import {
  isVultrScheduledMaintenance,
  mapVultr,
  parseVultrWindow,
  vultrAlertRollup,
  type VultrStatus,
} from "../src/vultr.js"

const FUTURE_WINDOW = `Event Type: Network Upgrade

Start Time: 2026-09-10 05:00:00 UTC
End Time: 2026-09-10 08:00:00 UTC
`

const LIVE_WINDOW = `Event Type: Network Upgrade

Start Time: 2026-09-05 01:00:00 UTC
End Time: 2026-09-05 04:00:00 UTC
`

const NOW = new Date("2026-09-05T03:00:00.000Z")

const scheduledAlert = {
  id: "maint-ord",
  subject: "Chicago Scheduled Maintenance - 2026-09-10",
  status: "ongoing",
  start_date: "2026-09-03T20:41:00+00:00",
  updated_at: "",
  entries: [{ updated_at: "2026-09-03T20:41:00+00:00", message: FUTURE_WINDOW }],
}

function payload(overrides: Partial<VultrStatus> = {}): VultrStatus {
  return {
    service_alerts: [],
    regions: {
      ams: { location: "Amsterdam", country: "NL", alerts: [] },
      ord: { location: "Chicago", country: "US", alerts: [scheduledAlert] },
    },
    ...overrides,
  }
}

test("parseVultrWindow reads Start Time / End Time from the alert body", () => {
  const window = parseVultrWindow(scheduledAlert)
  assert.equal(window.start?.toISOString(), "2026-09-10T05:00:00.000Z")
  assert.equal(window.end?.toISOString(), "2026-09-10T08:00:00.000Z")
})

test("isVultrScheduledMaintenance matches subject and Event Type", () => {
  assert.equal(isVultrScheduledMaintenance(scheduledAlert), true)
  assert.equal(
    isVultrScheduledMaintenance({
      id: "x",
      subject: "API latency",
      status: "ongoing",
      entries: [{ message: "Elevated latency in AMS" }],
    }),
    false,
  )
})

test("vultrAlertRollup ignores future scheduled windows", () => {
  assert.equal(vultrAlertRollup(scheduledAlert, NOW), "operational")
})

test("vultrAlertRollup paints an in-progress maintenance window", () => {
  const live = {
    ...scheduledAlert,
    subject: "Chicago Scheduled Maintenance - 2026-09-05",
    entries: [{ message: LIVE_WINDOW }],
  }
  assert.equal(vultrAlertRollup(live, NOW), "maintenance")
})

test("vultrAlertRollup maps outage language to major_outage", () => {
  assert.equal(
    vultrAlertRollup(
      {
        id: "down",
        subject: "Atlanta outage",
        status: "ongoing",
        entries: [{ message: "Instances unavailable" }],
      },
      NOW,
    ),
    "major_outage",
  )
})

test("mapVultr keeps the card operational when only future windows exist", () => {
  const state = mapVultr(payload(), { now: NOW })
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.source, "vultr")
  assert.equal(state.components.find((component) => component.externalId === "ord")?.status, "operational")
  assert.equal(state.incidents[0]?.status, "scheduled")
})

test("mapVultr paints from a live region outage and service alerts", () => {
  const state = mapVultr(
    payload({
      service_alerts: [
        {
          id: "billing",
          subject: "Elevated billing API latency",
          status: "ongoing",
          entries: [{ message: "Elevated latency on the billing API" }],
        },
      ],
      regions: {
        atl: {
          location: "Atlanta",
          alerts: [
            {
              id: "atl-down",
              subject: "Atlanta outage",
              status: "ongoing",
              entries: [{ message: "Network unavailable" }],
            },
          ],
        },
      },
    }),
    { now: NOW },
  )
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Atlanta outage")
  assert.equal(state.components[0]?.status, "major_outage")
})
