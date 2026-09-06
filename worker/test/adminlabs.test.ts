import assert from "node:assert/strict"
import test from "node:test"
import {
  mapAdminLabsClass,
  mapAdminLabsHtml,
  mapAdminlabsHtml,
  mapAdminlabsTone,
  parseAdminLabsComponents,
  parseAdminLabsIncidents,
  parseAdminLabsOverall,
  parseAdminlabsOverall,
} from "../src/adminlabs.js"

const DOCUMENT360_HTML = `
<div class="overall-status ok"><h1>All systems operational</h1></div>
<div class="block-item block-item-has-block-item-sub">
  <h3>Europe <span class="tooltip question-mark" data-tooltip-content="#component_region-eu">?</span></h3>
  <h4 class="status-title ok">Operational</h4>
  <div class="block-item-sub block-item-sub-first">
    <h3>Knowledge base <span class="tooltip question-mark" data-tooltip-content="#component_kb-eu">?</span></h3>
    <h4 class="status-title ok">Operational</h4>
  </div>
  <div class="block-item-sub">
    <h3>API Hub <span class="tooltip question-mark" data-tooltip-content="#component_hub-eu">?</span></h3>
    <h4 class="status-title warning">Degraded Performance</h4>
  </div>
</div>
<div class="block-item block-item-has-block-item-sub">
  <h3>Canada</h3>
  <h4 class="status-title ok">Operational</h4>
  <div id="child-canada-1" class="visible">
    <div class="block-item-sub">
      <h3>Portal </h3>
      <h4 class="status-title ok">Operational</h4>
    </div>
  </div>
</div>
<h5 class="update-title">Slowness in KB site and API Hub <a href="/status/incident/id/inc-open"></a></h5>
<p class="update-time"><b>Investigating</b> | Sep 6, 2026 | 12:00 GMT+00:00</p>
<h3>Timeouts in EU environment <a href="/status/incident/id/inc-resolved"></a></h3>
<p class="update-time"><b>Resolved</b> | Jun 23, 2026 | 16:20 GMT+01:00</p>
`

const EPPO_OK = `<div class="block block-overall-status">
  <div class="overall-status ok">
    <h1>All systems operational</h1>
  </div>
</div>
<div class="block block-incidents">
  <h2>Incident history</h2>
  No incidents reported.
</div>`

const EPPO_WITH_COMPONENTS = `<div class="block block-overall-status">
  <div class="overall-status warning">
    <h1>Partial system outage</h1>
  </div>
</div>
<div class="block block-components">
  <div class="block-item">
    <h3>API</h3>
    <span class="status-title error">Major outage</span>
  </div>
  <div class="block-item">
    <h3>Dashboard</h3>
    <span class="status-title ok">Operational</span>
  </div>
</div>
<div class="block block-incidents">
  <h2>Incident history</h2>
</div>`

test("mapAdminLabsClass covers Admin Labs CSS states", () => {
  assert.equal(mapAdminLabsClass("ok"), "operational")
  assert.equal(mapAdminLabsClass("notice"), "operational")
  assert.equal(mapAdminLabsClass("warning"), "degraded")
  assert.equal(mapAdminLabsClass("partial"), "partial_outage")
  assert.equal(mapAdminLabsClass("error"), "major_outage")
  assert.equal(mapAdminLabsClass("maintenance"), "maintenance")
})

test("parseAdminLabsComponents reads leaf monitors only", () => {
  const components = parseAdminLabsComponents(DOCUMENT360_HTML)
  assert.equal(components.length, 3)
  assert.equal(components[0].name, "Knowledge base")
  assert.equal(components[0].externalId, "kb-eu")
  assert.equal(components[0].status, "operational")
  assert.equal(components[1].name, "API Hub")
  assert.equal(components[1].status, "degraded")
  assert.equal(components[2].name, "Portal")
  assert.equal(components[2].externalId, "canada-1:portal")
})

test("parseAdminLabsIncidents reads incident history", () => {
  const incidents = parseAdminLabsIncidents(DOCUMENT360_HTML, "https://status.document360.com")
  assert.equal(incidents.length, 2)
  assert.equal(incidents[0].title, "Slowness in KB site and API Hub")
  assert.equal(incidents[0].status, "investigating")
  assert.equal(incidents[0].url, "https://status.document360.com/status/incident/id/inc-open")
  assert.equal(incidents[1].status, "resolved")
})

test("parseAdminLabsOverall reads the headline", () => {
  const overall = parseAdminLabsOverall(DOCUMENT360_HTML)
  assert.equal(overall.status, "operational")
  assert.equal(overall.headline, "All systems operational")
})

test("mapAdminLabsHtml rolls up leaf + open incident status", () => {
  const state = mapAdminLabsHtml(DOCUMENT360_HTML, "https://status.document360.com")
  assert.equal(state.detail.source, "admin_labs")
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "Slowness in KB site and API Hub")
  assert.equal(state.components.length, 3)
  assert.equal(state.incidents.length, 2)
})

test("mapAdminlabsTone covers AdminLabs CSS tones", () => {
  assert.equal(mapAdminlabsTone("ok"), "operational")
  assert.equal(mapAdminlabsTone("notice"), "operational")
  assert.equal(mapAdminlabsTone("warning"), "degraded")
  assert.equal(mapAdminlabsTone("error"), "major_outage")
  assert.equal(mapAdminlabsTone("maintenance"), "maintenance")
})

test("parseAdminlabsOverall reads the live Eppo heading", () => {
  const overall = parseAdminlabsOverall(EPPO_OK)
  assert.deepEqual(overall, { tone: "ok", title: "All systems operational" })
})

test("mapAdminlabsHtml accepts an overall-only page (Eppo)", () => {
  const state = mapAdminlabsHtml(EPPO_OK, "https://status.eppo.cloud")
  assert.equal(state.detail.source, "admin_labs")
  assert.equal(state.status, "operational")
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.incidentTitle, null)
})

test("mapAdminlabsHtml maps component tiles and worst-status rollup", () => {
  const state = mapAdminlabsHtml(EPPO_WITH_COMPONENTS, "https://status.eppo.cloud")
  assert.equal(state.status, "major_outage")
  assert.equal(state.components.length, 2)
  const byName = new Map(state.components.map((component) => [component.name, component]))
  assert.equal(byName.get("API")?.status, "major_outage")
  assert.equal(byName.get("Dashboard")?.status, "operational")
})

test("mapAdminlabsHtml throws without an overall-status block", () => {
  assert.throws(() => mapAdminlabsHtml("<html></html>", "https://status.eppo.cloud"))
})
