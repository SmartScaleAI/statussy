import assert from "node:assert/strict"
import test from "node:test"
import {
  extractSorryAppHeadline,
  extractSorryAppPageState,
  mapSorryAppState,
  mapWhimsicalHtml,
} from "../src/whimsical.js"

const operationalHtml = `<!doctype html><html><body>
<svg class="text-state-operational dark:text-state-dm-operational"></svg>
<h1 class="text-3xl"><span class="block">All systems are go!</span></h1>
<script id="component-grid-data" type="application/json">
[{"id":22602,"state":"operational","name":"Application","parent_id":null}]
</script>
</body></html>`

test("mapSorryAppState covers SorryApp component states", () => {
  assert.equal(mapSorryAppState("operational"), "operational")
  assert.equal(mapSorryAppState("degraded"), "degraded")
  assert.equal(mapSorryAppState("partial_outage"), "partial_outage")
  assert.equal(mapSorryAppState("outage"), "major_outage")
  assert.equal(mapSorryAppState("maintenance"), "maintenance")
  assert.equal(mapSorryAppState("nope"), "unknown")
})

test("extractSorryAppHeadline + page state from live-shaped HTML", () => {
  assert.equal(extractSorryAppHeadline(operationalHtml), "All systems are go!")
  assert.equal(extractSorryAppPageState(operationalHtml), "operational")
})

test("mapWhimsicalHtml is operational with the embedded component grid", () => {
  const state = mapWhimsicalHtml(operationalHtml)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.source, "sorryapp_html")
  assert.equal(state.components.length, 1)
  assert.equal(state.components[0]?.name, "Application")
  assert.equal(state.components[0]?.status, "operational")
  assert.equal(state.incidents.length, 0)
})

test("mapWhimsicalHtml paints a degraded component and headline", () => {
  const html = `<!doctype html><html><body>
<svg class="text-state-degraded"></svg>
<h1><span>We're experiencing some issues</span></h1>
<script id="component-grid-data" type="application/json">
[{"id":1,"state":"degraded","name":"Application"}]
</script>
</body></html>`
  const state = mapWhimsicalHtml(html)
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "We're experiencing some issues")
  assert.equal(state.incidents[0]?.impact, "degraded")
})

test("mapWhimsicalHtml throws on empty HTML", () => {
  assert.throws(() => mapWhimsicalHtml("<html><body>hi</body></html>"), /no page state/)
})
