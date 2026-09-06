import assert from "node:assert/strict"
import test from "node:test"
import { mapUxpin, uxpinServiceName, type UxpinStatus } from "../src/uxpin.js"

test("uxpinServiceName title-cases known services", () => {
  assert.equal(uxpinServiceName("editor"), "Editor")
  assert.equal(uxpinServiceName("api"), "API")
  assert.equal(uxpinServiceName("wire"), "Wire")
})

const allOk: UxpinStatus = {
  generated_at: "2026-09-06T13:00:00.000Z",
  services: [
    { service: "editor", ok: true, http_code: 200, checked_at: "2026-09-06T13:00:00.000Z" },
    { service: "preview", ok: true, http_code: 200, checked_at: "2026-09-06T13:00:00.000Z" },
    { service: "dashboard", ok: true, http_code: 200, checked_at: "2026-09-06T13:00:00.000Z" },
    { service: "api", ok: true, http_code: 200, checked_at: "2026-09-06T13:00:00.000Z" },
    { service: "wire", ok: true, http_code: 200, checked_at: "2026-09-06T13:00:00.000Z" },
  ],
}

test("mapUxpin is operational when every service is ok", () => {
  const state = mapUxpin(allOk)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 5)
  assert.equal(state.detail.source, "uxpin")
  assert.equal(state.incidents.length, 0)
  assert.equal(state.components[0]?.name, "Editor")
})

test("mapUxpin treats ok:false as a major outage + synthetic incident", () => {
  const payload: UxpinStatus = {
    ...allOk,
    services: [
      ...(allOk.services ?? []),
    ].map((row) => (row.service === "api" ? { ...row, ok: false, http_code: 503 } : row)),
  }
  const state = mapUxpin(payload)
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "API is not responding")
  assert.equal(state.components.find((component) => component.externalId === "api")?.status, "major_outage")
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0]?.externalId, "uxpin-api")
})

test("mapUxpin throws when the service list is empty", () => {
  assert.throws(() => mapUxpin({ services: [] }), /no services/)
})
