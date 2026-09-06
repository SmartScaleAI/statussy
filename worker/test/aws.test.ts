import assert from "node:assert/strict"
import test from "node:test"
import {
  decodeAwsPayload,
  mapAwsCurrentEvents,
  mapAwsEventStatus,
  parseAwsCurrentEvents,
  type AwsCurrentEvent,
} from "../src/aws.js"

const OPEN_EVENTS: AwsCurrentEvent[] = [
  {
    date: "1772369485",
    arn: "arn:aws:health:me-central-1::event/MULTIPLE_SERVICES/ISSUE_A",
    region_name: "UAE",
    status: "3",
    service: "multipleservices-me-central-1",
    service_name: "Multiple services",
    summary: "Increased Error Rates",
  },
  {
    date: "1772430987",
    arn: "arn:aws:health:me-south-1::event/MULTIPLE_SERVICES/ISSUE_B",
    region_name: "Bahrain",
    status: "3",
    service: "multipleservices-me-south-1",
    service_name: "Multiple services",
    summary: "Increased Error Rates",
  },
]

test("mapAwsEventStatus covers Health 0–3 codes", () => {
  assert.equal(mapAwsEventStatus(0), "operational")
  assert.equal(mapAwsEventStatus("1"), "degraded")
  assert.equal(mapAwsEventStatus(2), "partial_outage")
  assert.equal(mapAwsEventStatus("3"), "major_outage")
  assert.equal(mapAwsEventStatus("nope"), "unknown")
  assert.equal(mapAwsEventStatus(undefined), "unknown")
})

test("decodeAwsPayload reads UTF-16 BE with BOM", () => {
  const json = '[{"status":"0"}]'
  const body = Buffer.from("\uFEFF" + json, "utf16le")
  // utf16le BOM is FF FE; swap to BE FE FF for the decoder path.
  const be = Buffer.alloc(body.length)
  for (let i = 0; i < body.length; i += 2) {
    be[i] = body[i + 1]
    be[i + 1] = body[i]
  }
  assert.equal(be[0], 0xfe)
  assert.equal(be[1], 0xff)
  const text = decodeAwsPayload(new Uint8Array(be))
  assert.deepEqual(JSON.parse(text), [{ status: "0" }])
})

test("decodeAwsPayload falls back to UTF-8", () => {
  const text = decodeAwsPayload(new TextEncoder().encode("[]"))
  assert.equal(text, "[]")
})

test("parseAwsCurrentEvents rejects a non-array", () => {
  assert.throws(() => parseAwsCurrentEvents('{"status":3}'))
})

test("mapAwsCurrentEvents is operational on an empty list", () => {
  const state = mapAwsCurrentEvents([])
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.detail.source, "aws")
  assert.equal(state.detail.eventCount, 0)
})

test("mapAwsCurrentEvents paints the worst current event", () => {
  const state = mapAwsCurrentEvents(OPEN_EVENTS)
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Multiple services — UAE: Increased Error Rates")
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 2)
  assert.equal(state.incidents[0].externalId, OPEN_EVENTS[0].arn)
  assert.equal(state.incidents[0].status, "investigating")
  assert.equal(state.incidents[0].startedAt, "2026-03-01T12:51:25.000Z")
  assert.equal(state.detail.openEvents, 2)
})

test("mapAwsCurrentEvents treats status 0 as resolved and not a headline", () => {
  const state = mapAwsCurrentEvents([
    {
      date: "1772369485",
      arn: "arn:aws:health:us-east-1::event/OK",
      region_name: "N. Virginia",
      status: "0",
      service: "s3-us-east-1",
      service_name: "Amazon S3",
      summary: "Resolved",
    },
  ])
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents[0].status, "resolved")
})
