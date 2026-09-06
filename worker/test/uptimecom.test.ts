import assert from "node:assert/strict"
import test from "node:test"
import {
  mapUptimeComPage,
  mapUptimeComStatus,
  parseUptimeComControllerProps,
} from "../src/uptimecom.js"

const BUMP_HTML = `
<script>
  document.addEventListener('DOMContentLoaded', function (event) {
    const {createElement, ReactDOM, StatusPageDisplayController} = window.mainModule;
    ReactDOM.render(
      createElement(StatusPageDisplayController, {"siteURL":"https://uptime.com","brandName":"Uptime.com","statuspage":{"id":2181,"name":"System Status","slug":"bump","cname_url":"https://status.bump.sh","global_is_operational":true,"components":[{"id":9628,"is_group":false,"name":"Bump.sh API Portal","status":"operational","sorting_weight":0,"subcomponents":[]},{"id":9629,"is_group":false,"name":"Bump.sh Deployment Queue (API, CLI)","status":"degraded-performance","sorting_weight":1,"subcomponents":[]}],"active_incidents":[{"id":99,"name":"API latency","status":"investigating","started_at":"2026-09-06T10:00:00Z"}],"upcoming_maintenance":[]}}),
      document.getElementById('statuspagesDisplay'),
    );
  });
</script>
`

test("mapUptimeComStatus covers Uptime.com component states", () => {
  assert.equal(mapUptimeComStatus("operational"), "operational")
  assert.equal(mapUptimeComStatus("notification"), "operational")
  assert.equal(mapUptimeComStatus("degraded-performance"), "degraded")
  assert.equal(mapUptimeComStatus("partial-outage"), "partial_outage")
  assert.equal(mapUptimeComStatus("major-outage"), "major_outage")
  assert.equal(mapUptimeComStatus("under-maintenance"), "maintenance")
})

test("parseUptimeComControllerProps reads the hydrate payload", () => {
  const props = parseUptimeComControllerProps(BUMP_HTML)
  assert.equal(props.brandName, "Uptime.com")
  assert.equal(props.statuspage?.slug, "bump")
  assert.equal(props.statuspage?.components?.length, 2)
})

test("mapUptimeComPage rolls up components and active incidents", () => {
  const props = parseUptimeComControllerProps(BUMP_HTML)
  const state = mapUptimeComPage(props.statuspage!, "https://status.bump.sh")
  assert.equal(state.detail.source, "uptime_com")
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "API latency")
  assert.equal(state.components.length, 2)
  assert.equal(state.components[0].name, "Bump.sh API Portal")
  assert.equal(state.components[1].status, "degraded")
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].externalId, "99")
})

test("mapUptimeComPage rejects an empty component list", () => {
  assert.throws(() => mapUptimeComPage({ components: [] }, "https://status.bump.sh"))
})
