import assert from "node:assert/strict"
import test from "node:test"
import {
  mapAdminLabsClass,
  mapAdminLabsHtml,
  parseAdminLabsComponents,
  parseAdminLabsIncidents,
  parseAdminLabsOverall,
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
