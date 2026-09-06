import assert from "node:assert/strict"
import test from "node:test"
import {
  incidentTouchesRollup,
  isSalesforceIncidentOpen,
  mapSalesforce,
  mapSalesforceImpactSeverity,
  mapSalesforceType,
  salesforceIncidentTitle,
  type SalesforceIncident,
  type SalesforceProduct,
} from "../src/salesforce.js"

const services: SalesforceProduct[] = [
  {
    key: "Salesforce_Services",
    name: "Salesforce Services",
    altDisplayName: "Sales and Service",
    order: 0,
    isActive: true,
    incidentCount: 1,
    maintenanceCount: 34,
  },
  {
    key: "Community_Cloud",
    name: "Experience Cloud",
    altDisplayName: "Experience Cloud",
    order: 40,
    isActive: true,
    incidentCount: 0,
    maintenanceCount: 0,
  },
  {
    key: "Heroku",
    name: "Heroku",
    order: 80,
    isActive: true,
    incidentCount: 1,
    maintenanceCount: 0,
  },
]

const couponIncident: SalesforceIncident = {
  id: 20004387,
  status: "Active",
  type: "Degradation",
  isCore: false,
  createdAt: "2026-09-01T13:56:48.761Z",
  serviceKeys: ["B2BCommerce"],
  IncidentImpacts: [
    {
      startTime: "2026-08-29T01:00:00.000Z",
      endTime: null,
      type: "featurePerfDegradation",
      severity: "minor",
    },
  ],
  IncidentEvents: [
    {
      id: 1,
      type: "investigating",
      message:
        "We're investigating an issue where a subset of B2B Commerce Cloud customers may find that the Standard Coupon Code component is not visible on the Cart page.",
      createdAt: "2026-09-01T14:02:41.597Z",
    },
    {
      id: 2,
      type: "update",
      message: "We continue to work on resolving the coupon component issue.",
      createdAt: "2026-09-04T06:07:05.272Z",
    },
  ],
}

const herokuIncident: SalesforceIncident = {
  id: 99,
  status: "Active",
  type: "Outage",
  serviceKeys: ["HerokuRuntime"],
  IncidentImpacts: [{ endTime: null, severity: "critical" }],
}

test("mapSalesforceType and impact severity cover Trust vocab", () => {
  assert.equal(mapSalesforceType("Degradation"), "degraded")
  assert.equal(mapSalesforceType("featurePerfDegradation"), "degraded")
  assert.equal(mapSalesforceType("serviceDisruption"), "partial_outage")
  assert.equal(mapSalesforceType("Outage"), "major_outage")
  assert.equal(mapSalesforceType("maintenance"), "maintenance")
  assert.equal(mapSalesforceImpactSeverity("minor"), "degraded")
  assert.equal(mapSalesforceImpactSeverity("major"), "partial_outage")
  assert.equal(mapSalesforceImpactSeverity("critical"), "major_outage")
})

test("salesforceIncidentTitle uses the oldest event sentence", () => {
  assert.match(salesforceIncidentTitle(couponIncident), /Standard Coupon Code/)
})

test("incidentTouchesRollup keeps Salesforce Services and drops Heroku", () => {
  const map = {
    B2BCommerce: ["Salesforce_Services"],
    HerokuRuntime: ["Heroku"],
  }
  assert.equal(incidentTouchesRollup(couponIncident, map), true)
  assert.equal(incidentTouchesRollup(herokuIncident, map), false)
  assert.equal(isSalesforceIncidentOpen(couponIncident), true)
})

test("mapSalesforce rolls up two products and ignores instance-scale counts", () => {
  const state = mapSalesforce({
    products: services,
    incidents: [couponIncident, herokuIncident],
    serviceProducts: {
      B2BCommerce: ["Salesforce_Services"],
      HerokuRuntime: ["Heroku"],
    },
  })
  assert.equal(state.detail.source, "salesforce")
  assert.equal(state.status, "degraded")
  assert.equal(state.components.length, 2)
  assert.equal(state.components[0].name, "Sales and Service")
  assert.equal(state.components[0].status, "degraded")
  assert.equal(state.components[1].name, "Experience Cloud")
  assert.equal(state.components[1].status, "operational")
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].externalId, "20004387")
  assert.equal(state.incidentTitle, salesforceIncidentTitle(couponIncident))
  assert.ok(!state.components.some((component) => /CS\d+|USA\d+/.test(component.name)))
})

test("mapSalesforce is operational when rollup products are quiet", () => {
  const state = mapSalesforce({
    products: services.map((product) => ({ ...product, incidentCount: 0 })),
    incidents: [],
    serviceProducts: {},
  })
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 2)
})

test("mapSalesforce throws when rollup products are missing", () => {
  assert.throws(() => mapSalesforce({ products: [services[2]], incidents: [] }))
})
