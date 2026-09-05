import assert from "node:assert/strict"
import test from "node:test"
import { mapOracleCloud } from "../src/oracle-cloud.js"

test("mapOracleCloud uses the page-level indicator and stores no catalog", () => {
  const state = mapOracleCloud({
    page: { name: "OCI", updated_at: "2026-08-25T06:25:51.138Z" },
    status: { description: "Normal Performance", indicator: "none" },
  })
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.source, "oracle_cloud")
  assert.equal(state.detail.indicator, "none")
  assert.deepEqual(state.components, [])
  assert.deepEqual(state.incidents, [])
})

test("mapOracleCloud maps a critical indicator", () => {
  const state = mapOracleCloud({
    status: { indicator: "critical", description: "Service Disruption" },
  })
  assert.equal(state.status, "major_outage")
})
