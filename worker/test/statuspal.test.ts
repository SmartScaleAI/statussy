import assert from "node:assert/strict"
import test from "node:test"
import {
  mapStatuspalHtml,
  mapStatuspalType,
  parseStatuspalIncidents,
  parseStatuspalServices,
} from "../src/statuspal.js"

const CHARTMOGUL_HTML = `
<div id="service-4415" class="service-status status-type-none ">
  <div class="service-status--info">
    <span class="service-status--name">ChartMogul App</span>
    <span class="service-status--status"> Operational </span>
  </div>
</div>
<div id="service-4416" class="service-status status-type-minor ">
  <div class="service-status--info">
    <span class="service-status--name">ChartMogul API</span>
    <span class="service-status--status"> Degraded Performance </span>
  </div>
</div>
<div id="service-4472" class="service-status status-type-none ">
  <div class="service-status--info">
    <span class="service-status--name">Integration Services</span>
    <span class="service-status--status"> Operational </span>
  </div>
</div>
<div class="incidents-container"></div>
<script>
  window.incidents = [{"id":245923,"title":"Data Processing Delays - Reporting Tools Affected","starts_at":"2026-08-17T14:37:07","ends_at":"2026-08-17T18:14:26","i_type":{"key":"minor","is_maintenance":false}},{"id":247500,"title":"API latency","starts_at":"2026-09-06T10:00:00","ends_at":null,"i_type":{"key":"minor","is_maintenance":false}}];
</script>
`

test("mapStatuspalType covers Statuspal tile types", () => {
  assert.equal(mapStatuspalType("none"), "operational")
  assert.equal(mapStatuspalType("minor"), "degraded")
  assert.equal(mapStatuspalType("major"), "major_outage")
  assert.equal(mapStatuspalType("scheduled"), "maintenance")
})

test("parseStatuspalServices reads named tiles", () => {
  const components = parseStatuspalServices(CHARTMOGUL_HTML)
  assert.equal(components.length, 3)
  assert.equal(components[0].name, "ChartMogul App")
  assert.equal(components[0].status, "operational")
  assert.equal(components[1].name, "ChartMogul API")
  assert.equal(components[1].status, "degraded")
  assert.equal(components[1].externalId, "4416")
})

test("parseStatuspalIncidents reads window.incidents", () => {
  const incidents = parseStatuspalIncidents(CHARTMOGUL_HTML, "https://status.chartmogul.com")
  assert.equal(incidents.length, 2)
  assert.equal(incidents[0].status, "resolved")
  assert.equal(incidents[1].status, "investigating")
  assert.equal(incidents[1].title, "API latency")
})

test("mapStatuspalHtml rolls up tile + open incident status", () => {
  const state = mapStatuspalHtml(CHARTMOGUL_HTML, "https://status.chartmogul.com")
  assert.equal(state.detail.source, "statuspal")
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "API latency")
  assert.equal(state.components.length, 3)
  assert.equal(state.incidents.length, 2)
})
