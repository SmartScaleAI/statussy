import assert from "node:assert/strict"
import test from "node:test"
import {
  isOktaResolved,
  mapOkta,
  mapOktaCategory,
  parseOktaHtml,
  type OktaIncident,
  type OktaPage,
} from "../src/okta.js"

const resolved: OktaIncident = {
  Id: "a9CWR0000002Hcg2AE",
  Name: "I-11355",
  Status__c: "Resolved",
  Category__c: "Service Degradation",
  Incident_Title__c: "Error 500 observed in OP1",
  Impacted_Cells__c: "oktapreview.com:1",
  Start_Time__c: "2026-09-03T09:30:00.000+0000",
  Last_Updated__c: "2026-09-03T14:09:06.000+0000",
  End_Date__c: "2026-09-03",
}

const openDegraded: OktaIncident = {
  Id: "a9CWR0000002OPEN",
  Name: "I-12000",
  Status__c: "Investigating",
  Category__c: "Service Degradation",
  Incident_Title__c: "Workflow front door errors",
  Impacted_Cells__c: "okta.com:1;okta.com:2",
  Start_Time__c: "2026-09-06T10:00:00.000+0000",
  Last_Updated__c: "2026-09-06T10:30:00.000+0000",
}

const openMajor: OktaIncident = {
  Id: "a9CWR0000002RED",
  Name: "I-12001",
  Status__c: "Identified",
  Category__c: "Major Service Disruption",
  Incident_Title__c: "Login failures in US-1",
  Impacted_Cells__c: "okta.com:1",
  Is_Mis_Red__c: true,
  Start_Time__c: "2026-09-06T11:00:00.000+0000",
  Last_Updated__c: "2026-09-06T11:10:00.000+0000",
}

const scheduled: OktaIncident = {
  Id: "a9CWR0000002PLAN",
  Name: "P-44",
  Status__c: "Scheduled",
  Category__c: "Planned Maintenance",
  Incident_Title__c: "Extended Maintenance Window",
  Impacted_Cells__c: "okta-emea.com:1",
  Start_Time__c: "2026-09-07T01:00:00.000+0000",
}

function page(overrides: Partial<OktaPage> = {}): OktaPage {
  return {
    incidents: [resolved],
    plannedOutages: [],
    cells: ["okta.com:1", "okta.com:2", "okta-emea.com:1", "oktapreview.com:1"],
    ...overrides,
  }
}

const SAMPLE_HTML = `
<title>Okta Status | System Status</title>
<span id="j_id0:j_id10:StringJSON" class="visibility: hidden" data-id="incidents">[{"attributes":{"type":"Incident__c"},"Id":"a9CWR0000002Hcg2AE","Name":"I-11355","Status__c":"Resolved","Category__c":"Service Degradation","Incident_Title__c":"Error 500 observed in OP1","Impacted_Cells__c":"oktapreview.com:1","Start_Time__c":"2026-09-03T09:30:00.000+0000","Last_Updated__c":"2026-09-03T14:09:06.000+0000"}]</span>
<span id="j_id0:j_id10:PlannedOutageStringJSON" class="visibility: hidden" data-id="planned-outages">[]</span>
<span id="j_id0:j_id10:CellList" class="visibility: hidden" data-id="cellList">okta.com:1,okta.com:2,oktapreview.com:1</span>
`

test("mapOktaCategory covers Trust categories", () => {
  assert.equal(mapOktaCategory("Service Degradation"), "degraded")
  assert.equal(mapOktaCategory("Performance Issue"), "degraded")
  assert.equal(mapOktaCategory("Service Disruption"), "partial_outage")
  assert.equal(mapOktaCategory("Minor Service Disruption"), "partial_outage")
  assert.equal(mapOktaCategory("Feature Disruption"), "partial_outage")
  assert.equal(mapOktaCategory("Major Service Disruption"), "major_outage")
  assert.equal(mapOktaCategory("Planned Maintenance"), "maintenance")
  assert.equal(mapOktaCategory("nope"), "unknown")
  assert.equal(isOktaResolved("Resolved"), true)
  assert.equal(isOktaResolved("Investigating"), false)
})

test("mapOkta is operational when every Incident__c is resolved", () => {
  const state = mapOkta(page())
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.source, "okta")
  assert.equal(state.components.length, 4)
  assert.ok(state.components.every((component) => component.status === "operational"))
  assert.equal(state.incidents[0]?.status, "resolved")
  assert.equal(state.incidents[0]?.title, "Error 500 observed in OP1")
})

test("mapOkta uses the worst open incident and paints impacted cells", () => {
  const state = mapOkta(page({ incidents: [resolved, openDegraded, openMajor] }))
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Login failures in US-1")
  assert.equal(
    state.components.find((component) => component.externalId === "okta.com:1")?.status,
    "major_outage",
  )
  assert.equal(
    state.components.find((component) => component.externalId === "okta.com:2")?.status,
    "degraded",
  )
  assert.equal(
    state.components.find((component) => component.externalId === "oktapreview.com:1")?.status,
    "operational",
  )
})

test("mapOkta treats scheduled planned outages as maintenance", () => {
  const state = mapOkta(page({ plannedOutages: [scheduled] }))
  assert.equal(state.status, "maintenance")
  assert.equal(state.incidentTitle, "Extended Maintenance Window")
  assert.equal(
    state.components.find((component) => component.externalId === "okta-emea.com:1")?.status,
    "maintenance",
  )
})

test("parseOktaHtml reads Salesforce data-id spans", () => {
  const parsed = parseOktaHtml(SAMPLE_HTML)
  assert.equal(parsed.incidents.length, 1)
  assert.equal(parsed.incidents[0]?.Incident_Title__c, "Error 500 observed in OP1")
  assert.deepEqual(parsed.plannedOutages, [])
  assert.deepEqual(parsed.cells, ["okta.com:1", "okta.com:2", "oktapreview.com:1"])
  const state = mapOkta(parsed)
  assert.equal(state.status, "operational")
  assert.equal(state.components.length, 3)
})

test("parseOktaHtml throws when the incidents span is missing", () => {
  assert.throws(() => parseOktaHtml("<html></html>"), /data-id="incidents"/)
})
