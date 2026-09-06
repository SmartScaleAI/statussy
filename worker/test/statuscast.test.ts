import assert from "node:assert/strict"
import test from "node:test"
import {
  mapStatuscastHtml,
  mapStatuscastLabel,
  parseStatuscastHero,
  parseStatuscastIncidents,
  statuscastPaintsCard,
} from "../src/statuscast.js"

const FASTLY_HTML = `
<body class="sc-state-normal">
  <div class="sc-hero">
    <div class="sc-hero__status-label">
      <span class="sc-status-dot"></span>
      <span>All Systems Operational</span>
    </div>
    <h1 class="sc-hero__title">All Systems Operational</h1>
  </div>
  <div class="row incident-body incident-type-serviceunavailable incident-status-inprogress incident-mostsevere-status-informational">
    <a class="incident-partial-title-url" href="/incident/378791">
      <h2 class="incident-title" aria-label="Incident Title">Update to waitlist disconnect response codes</h2>
    </a>
    <div class="incident-date" aria-label="Incident Date">02 September 2026, 17:05  UTC</div>
  </div>
  <div class="row incident-body incident-type-scheduledmaintenance incident-status-future incident-mostsevere-status-maintenance">
    <a class="incident-partial-title-url" href="/incident/378771">
      <h2 class="incident-title" aria-label="Incident Title">Fastly Support Portal and AI chatbot</h2>
    </a>
    <div class="incident-date" aria-label="Incident Date">10 September 2026, 00:00  UTC</div>
  </div>
</body>
`

const OUTAGE_HTML = `
<h1 class="sc-hero__title">Service Disruption</h1>
<div class="row incident-body incident-type-serviceunavailable incident-status-inprogress incident-mostsevere-status-unavailable">
  <a href="/incident/100">
    <h2 class="incident-title" aria-label="Incident Title">POP connectivity</h2>
  </a>
  <div aria-label="Incident Date">06 September 2026, 12:00  UTC</div>
</div>
`

test("mapStatuscastLabel covers StatusCast hero labels", () => {
  assert.equal(mapStatuscastLabel("All Systems Operational"), "operational")
  assert.equal(mapStatuscastLabel("Informational"), "operational")
  assert.equal(mapStatuscastLabel("Degraded Performance"), "degraded")
  assert.equal(mapStatuscastLabel("Service Disruption"), "partial_outage")
  assert.equal(mapStatuscastLabel("Service Unavailable"), "major_outage")
  assert.equal(mapStatuscastLabel("Maintenance"), "maintenance")
})

test("parseStatuscastHero reads the h1 rollup", () => {
  assert.equal(parseStatuscastHero(FASTLY_HTML), "All Systems Operational")
})

test("parseStatuscastIncidents reads current rows only", () => {
  const incidents = parseStatuscastIncidents(FASTLY_HTML)
  assert.equal(incidents.length, 2)
  assert.equal(incidents[0].id, "378791")
  assert.equal(incidents[0].severity, "informational")
  assert.equal(incidents[0].lifecycle, "inprogress")
  assert.equal(statuscastPaintsCard(incidents[0]), false)
  assert.equal(incidents[1].id, "378771")
  assert.equal(incidents[1].lifecycle, "future")
  assert.equal(statuscastPaintsCard(incidents[1]), false)
})

test("mapStatuscastHtml stays operational for info + future maintenance", () => {
  const state = mapStatuscastHtml(FASTLY_HTML, "https://www.fastlystatus.com")
  assert.equal(state.detail.source, "statuscast")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 2)
  assert.equal(state.incidents[0].url, "https://www.fastlystatus.com/incident/378791")
  assert.equal(state.incidents[1].status, "scheduled")
})

test("mapStatuscastHtml paints an in-progress disruption", () => {
  const state = mapStatuscastHtml(OUTAGE_HTML, "https://www.fastlystatus.com")
  assert.equal(state.status, "partial_outage")
  assert.equal(state.incidentTitle, "POP connectivity")
  assert.equal(state.incidents[0].status, "investigating")
})

test("mapStatuscastHtml throws when the hero is missing", () => {
  assert.throws(() => mapStatuscastHtml("<html><body>nope</body></html>", "https://example.test"))
})
