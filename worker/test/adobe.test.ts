import assert from "node:assert/strict"
import test from "node:test"
import {
  isAdobeHistoryOpen,
  latestAdobeHistory,
  mapAdobe,
  mapAdobeSeverity,
  type AdobeEvents,
  type AdobeRegistry,
} from "../src/adobe.js"

test("mapAdobeSeverity covers Adobe severities", () => {
  assert.equal(mapAdobeSeverity("Trivial"), "degraded")
  assert.equal(mapAdobeSeverity("minor"), "degraded")
  assert.equal(mapAdobeSeverity("Major"), "partial_outage")
  assert.equal(mapAdobeSeverity("critical"), "major_outage")
  assert.equal(mapAdobeSeverity("Potential"), "unknown")
  assert.equal(mapAdobeSeverity(undefined), "unknown")
})

test("latestAdobeHistory + isAdobeHistoryOpen use the newest entry", () => {
  const last = latestAdobeHistory({
    history: {
      "100": { status: "Opened", severity: "Minor", statusTime: 100 },
      "200": { status: "Closed", severity: "Minor", statusTime: 200 },
    },
  })
  assert.equal(last?.status, "Closed")
  assert.equal(isAdobeHistoryOpen(last), false)
  assert.equal(isAdobeHistoryOpen({ status: "Opened" }), true)
  assert.equal(isAdobeHistoryOpen({ status: "Discovery" }), true)
  assert.equal(isAdobeHistoryOpen({ status: "Dismissed" }), false)
})

const registry: AdobeRegistry = {
  clouds: { "1": { id: "1", name: "Creative Cloud" } },
  products: {
    "10": { id: "10", name: "Photoshop" },
    "20": { id: "20", name: "Adobe Express" },
    "30": { id: "30", name: "Adobe Marketo Engage" },
  },
}

test("mapAdobe is operational when every product history is closed", () => {
  const events: AdobeEvents = {
    incidentEvent: {
      incidents: {
        "202601010001": {
          id: "202601010001",
          products: {
            "10": {
              id: "10",
              name: "Photoshop",
              startedOn: 1,
              endedOn: 2,
              history: {
                "2": { status: "Closed", severity: "Minor", titleToken: "title.CM0001011" },
              },
            },
          },
        },
      },
      messages: {
        en: {
          "title.CM0001011": {
            token: "title.CM0001011",
            textMessage: "We’ve closed a minor issue",
          },
        },
      },
    },
    maintenanceEvent: { maintenance: {} },
  }
  const state = mapAdobe(registry, events)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 3)
  assert.equal(state.detail.source, "adobe")
  assert.equal(state.incidents.length, 0)
})

test("mapAdobe paints open incidents and started maintenance", () => {
  const events: AdobeEvents = {
    incidentEvent: {
      incidents: {
        "202609060001": {
          id: "202609060001",
          products: {
            "10": {
              id: "10",
              name: "Photoshop",
              startedOn: 1788600000,
              endedOn: 0,
              history: {
                "1788600000": {
                  status: "Opened",
                  severity: "Major",
                  titleToken: "title.CM0001002",
                  statusTime: 1788600000,
                },
              },
            },
          },
        },
      },
      messages: {
        en: {
          "title.CM0001002": {
            token: "title.CM0001002",
            textMessage: "We’ve opened a major issue",
          },
        },
      },
    },
    maintenanceEvent: {
      maintenance: {
        CHG1: {
          id: "CHG1",
          status: "Started",
          startedOn: 1788601000,
          products: {
            "30": {
              id: "30",
              name: "Adobe Marketo Engage",
              history: {
                "1788601000": { status: "Started", titleToken: "title.CM0004067" },
              },
            },
          },
        },
      },
      messages: {
        en: {
          "title.CM0004067": {
            token: "title.CM0004067",
            textMessage: "We’ve begun maintenance to improve our services.",
          },
        },
      },
    },
  }
  const state = mapAdobe(registry, events)
  assert.equal(state.status, "partial_outage")
  assert.equal(state.incidentTitle, "We’ve opened a major issue")
  assert.equal(
    state.components.find((component) => component.name === "Photoshop")?.status,
    "partial_outage",
  )
  assert.equal(
    state.components.find((component) => component.name === "Adobe Marketo Engage")?.status,
    "maintenance",
  )
  assert.equal(state.incidents.length, 2)
  assert.equal(state.incidents[0].startedAt, "2026-09-05T09:20:00.000Z")
})
