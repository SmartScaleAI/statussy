import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  PAGERDUTY_IMPACTED_API,
  PAGERDUTY_SERVICES_API,
  fetchPagerDutyState,
  mapPagerDuty,
  mapPagerDutyImpact,
  type PagerDutyImpactedPayload,
  type PagerDutyServicesPayload,
} from "../src/pagerduty.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

async function loadServices(): Promise<PagerDutyServicesPayload> {
  return JSON.parse(await readFile(join(FIXTURES, "pagerduty-services.json"), "utf8"))
}

test("mapPagerDutyImpact covers published IDs and name fallbacks", () => {
  assert.equal(mapPagerDutyImpact(null, "PH7XL8Z"), "partial_outage")
  assert.equal(mapPagerDutyImpact(null, "PDY9KW9"), "major_outage")
  assert.equal(mapPagerDutyImpact(null, "P194FYD"), "maintenance")
  assert.equal(mapPagerDutyImpact(null, "PKGILKM"), "operational")
  assert.equal(mapPagerDutyImpact(null, "P5WKMQ5"), "degraded")
  assert.equal(mapPagerDutyImpact("PARTIAL_OUTAGE"), "partial_outage")
  assert.equal(mapPagerDutyImpact("outage"), "major_outage")
  assert.equal(mapPagerDutyImpact("minor"), "degraded")
  assert.equal(mapPagerDutyImpact("incident/impacts/maintenance"), "maintenance")
  assert.equal(mapPagerDutyImpact("all good"), "operational")
  assert.equal(mapPagerDutyImpact("something_new"), "unknown")
  assert.equal(mapPagerDutyImpact(undefined), "unknown")
})

test("mapPagerDuty is operational when impacted_services is empty", async () => {
  const state = mapPagerDuty(await loadServices(), {
    status_page_id: "P67C5DQ",
    impacted_services: [],
  })
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.source, "pagerduty")
  assert.equal(state.detail.impactedCount, 0)
  assert.equal(state.components.length, 6)
  assert.equal(state.components[0].name, "Events API (US)")
  assert.equal(state.components[5].name, "Incident Timeline and Alert Logs (US)")
  assert.ok(state.components.every((component) => component.status === "operational"))
  assert.equal(state.incidents.length, 0)
})

test("mapPagerDuty paints impacted components and the overall rollup", async () => {
  const impacted: PagerDutyImpactedPayload = {
    status_page_id: "P67C5DQ",
    impacted_services: [
      { service_id: "PDACBTY", impact_severity_id: "PH7XL8Z" },
      {
        service_id: "PWS3A1I",
        impact_severity_id: "PDY9KW9",
        post_id: "P0YMKFH",
        title: "Web Application (US) outage",
        post_type: "incident",
      },
    ],
  }
  const state = mapPagerDuty(await loadServices(), impacted)
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Web Application (US) outage")
  assert.equal(state.detail.impactedCount, 2)
  assert.equal(
    state.components.find((component) => component.externalId === "PDACBTY")?.status,
    "partial_outage",
  )
  assert.equal(
    state.components.find((component) => component.externalId === "PWS3A1I")?.status,
    "major_outage",
  )
  assert.equal(
    state.components.find((component) => component.externalId === "P63OY6Y")?.status,
    "operational",
  )
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].status, "investigating")
  assert.equal(state.incidents[0].url, "https://status.pagerduty.com")
})

test("mapPagerDuty treats an unknown impact id as degraded, not unknown", async () => {
  const state = mapPagerDuty(await loadServices(), {
    status_page_id: "P67C5DQ",
    impacted_services: [{ service_id: "PK7GWG9", impact_severity_id: "PNEWENUM" }],
  })
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "SMS (US)")
  assert.equal(
    state.components.find((component) => component.externalId === "PK7GWG9")?.status,
    "degraded",
  )
})

test("mapPagerDuty skips inactive services and throws when none remain", () => {
  const inactive: PagerDutyServicesPayload = {
    services: [{ id: "X", name: "Gone", is_active: false }],
  }
  assert.throws(
    () => mapPagerDuty(inactive, { impacted_services: [] }),
    /no active services/,
  )
})

test("fetchPagerDutyState hits both public JSON endpoints", async () => {
  const services = await loadServices()
  const seen: string[] = []
  const fetchImpl: typeof fetch = async (url) => {
    seen.push(String(url))
    const body =
      String(url) === PAGERDUTY_SERVICES_API
        ? services
        : { status_page_id: "P67C5DQ", impacted_services: [] }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  const state = await fetchPagerDutyState({
    timeoutMs: 5000,
    userAgent: "statussy-worker/0.1 (+https://github.com/SmartScaleAI/statussy)",
    fetchImpl,
  })

  assert.deepEqual(seen.sort(), [PAGERDUTY_IMPACTED_API, PAGERDUTY_SERVICES_API].sort())
  assert.equal(state.status, "operational")
  assert.equal(state.detail.source, "pagerduty")
  assert.equal(state.components.length, 6)
})
