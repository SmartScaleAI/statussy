import assert from "node:assert/strict"
import test from "node:test"
import {
  CONVERT_STATUSPAGE_IO,
  mapPingdomCheckStatus,
  mapPingdomComponents,
  parsePingdomChecksJson,
  parsePingdomNoscript,
} from "../src/pingdom.js"

const NOSCRIPT = `<table id="checks-overview">
  <tbody>
    <tr>
      <td class="check-status">
        <span class="status up" title="Current status: Up"></span>
      </td>
      <td class="check-name"><a target="_parent" href="/1043925">Convert Experiments  non-SSL script</a></td>
    </tr>
    <tr>
      <td class="check-status">
        <span class="status down" title="Current status: Down"></span>
      </td>
      <td class="check-name"><a target="_parent" href="/1881782">Convert Experiments SSL script</a></td>
    </tr>
  </tbody>
</table>`

test("mapPingdomCheckStatus covers Pingdom check tokens", () => {
  assert.equal(mapPingdomCheckStatus("up"), "operational")
  assert.equal(mapPingdomCheckStatus("down"), "major_outage")
  assert.equal(mapPingdomCheckStatus("paused"), "unknown")
})

test("parsePingdomNoscript reads named checks from the public table", () => {
  const components = parsePingdomNoscript(NOSCRIPT)
  assert.equal(components.length, 2)
  assert.equal(components[0]?.externalId, "1043925")
  assert.equal(components[0]?.status, "operational")
  assert.equal(components[1]?.name, "Convert Experiments SSL script")
  assert.equal(components[1]?.status, "major_outage")
})

test("parsePingdomChecksJson reads the DataTables /checks payload", () => {
  const components = parsePingdomChecksJson({
    aaData: [
      [
        '<span class="status up" title="Current status: Up"></span>',
        '<a target="_parent" href="/11908146">New Convert Experiments  non-SSL script</a>',
      ],
    ],
  })
  assert.equal(components[0]?.externalId, "11908146")
  assert.equal(components[0]?.status, "operational")
})

test("mapPingdomComponents rolls worst check status and refuses convert.statuspage.io", () => {
  const state = mapPingdomComponents(parsePingdomNoscript(NOSCRIPT), "https://status.convert.com")
  assert.equal(state.detail.source, "pingdom")
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidents.length, 0)
  assert.throws(() =>
    mapPingdomComponents(parsePingdomNoscript(NOSCRIPT), CONVERT_STATUSPAGE_IO),
  )
})
