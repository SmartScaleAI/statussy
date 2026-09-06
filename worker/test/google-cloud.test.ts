import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  incidentAffectsGemini,
  isGeminiProduct,
  isOpenIncident,
  mapGoogleCloud,
  mapGoogleCloudPlatform,
  mapGoogleCloudImpact,
  mapGoogleCloudImpactLabel,
  parseProductsPayload,
  VERTEX_GEMINI_API_PRODUCT_ID,
  type GoogleCloudIncident,
  type GoogleCloudProduct,
} from "../src/google-cloud.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

async function loadFixtures(): Promise<{
  incidents: GoogleCloudIncident[]
  products: GoogleCloudProduct[]
}> {
  const incidents = JSON.parse(
    await readFile(join(FIXTURES, "google-cloud-incidents.json"), "utf8"),
  ) as GoogleCloudIncident[]
  const productsBody = JSON.parse(
    await readFile(join(FIXTURES, "google-cloud-products.json"), "utf8"),
  )
  return { incidents, products: parseProductsPayload(productsBody) }
}

test("isGeminiProduct matches Vertex Gemini API and Gemini* siblings", () => {
  assert.equal(isGeminiProduct({ id: VERTEX_GEMINI_API_PRODUCT_ID, title: "Vertex Gemini API" }), true)
  assert.equal(isGeminiProduct({ id: "deUeOEPYanfJ9w8cpyBJ", title: "Gemini Code Assist" }), true)
  assert.equal(isGeminiProduct({ id: "cxUh24jPxEXgyRlaVhuk", current_title: "Gemini Enterprise" }), true)
  assert.equal(isGeminiProduct({ id: "L3ggmi3Jy4xJmgodFA9K", title: "Google Compute Engine" }), false)
})

test("isOpenIncident treats missing/blank end as open", () => {
  assert.equal(isOpenIncident({}), true)
  assert.equal(isOpenIncident({ end: null }), true)
  assert.equal(isOpenIncident({ end: "" }), true)
  assert.equal(isOpenIncident({ end: "2026-09-04T12:00:00+00:00" }), false)
})

test("mapGoogleCloudImpact covers Cloud Status impacts and severity fallback", () => {
  assert.equal(mapGoogleCloudImpact("SERVICE_OUTAGE"), "major_outage")
  assert.equal(mapGoogleCloudImpact("SERVICE_DISRUPTION"), "partial_outage")
  assert.equal(mapGoogleCloudImpact("SERVICE_INFORMATION"), "degraded")
  assert.equal(mapGoogleCloudImpact("SERVICE_MAINTENANCE"), "maintenance")
  assert.equal(mapGoogleCloudImpact("service_outage"), "major_outage")
  assert.equal(mapGoogleCloudImpact(undefined, "high"), "major_outage")
  assert.equal(mapGoogleCloudImpact(undefined, "medium"), "partial_outage")
  assert.equal(mapGoogleCloudImpact(undefined, "low"), "degraded")
  assert.equal(mapGoogleCloudImpact("NOPE", "nope"), "unknown")
  assert.equal(mapGoogleCloudImpact(undefined), "unknown")
})

test("mapGoogleCloudImpactLabel normalizes to Statuspage-style labels", () => {
  assert.equal(mapGoogleCloudImpactLabel("SERVICE_OUTAGE"), "critical")
  assert.equal(mapGoogleCloudImpactLabel("SERVICE_DISRUPTION"), "major")
  assert.equal(mapGoogleCloudImpactLabel("SERVICE_INFORMATION"), "minor")
  assert.equal(mapGoogleCloudImpactLabel("SERVICE_MAINTENANCE"), "maintenance")
  assert.equal(mapGoogleCloudImpactLabel(null), null)
})

test("mapGoogleCloud parses the sample incidents.json against Gemini products", async () => {
  const { incidents, products } = await loadFixtures()
  const state = mapGoogleCloud(incidents, products)

  assert.equal(state.status, "partial_outage")
  assert.equal(state.detail.source, "google_cloud")
  assert.equal(state.detail.openIncidentCount, 2)
  assert.equal(
    state.incidentTitle,
    "Vertex AI Gemini API customers experiencing increased error rates.",
  )

  // Compute Engine outage is ignored; closed Gemini incident is kept as history.
  assert.equal(state.incidents.length, 3)
  const byId = new Map(state.incidents.map((i) => [i.externalId, i]))
  assert.equal(byId.has("open-compute"), false)

  const openVertex = byId.get("open-vertex-gemini")
  assert.equal(openVertex?.status, "active")
  assert.equal(openVertex?.impact, "major")
  assert.equal(openVertex?.resolvedAt, null)
  assert.equal(openVertex?.startedAt, "2026-09-04T12:00:00.000Z")
  assert.equal(openVertex?.url, "https://status.cloud.google.com/incidents/open-vertex-gemini")

  const closed = byId.get("closed-vertex-gemini")
  assert.equal(closed?.status, "resolved")
  assert.equal(closed?.resolvedAt, "2026-02-27T14:35:00.000Z")

  const sibling = byId.get("open-gemini-code-assist")
  assert.equal(sibling?.status, "active")
  assert.equal(sibling?.impact, "minor")

  assert.equal(state.components.length, 3)
  const byName = new Map(state.components.map((c) => [c.name, c]))
  assert.equal(byName.get("Gemini on Agent Platform")?.status, "partial_outage")
  assert.equal(byName.get("Gemini on Agent Platform")?.externalId, VERTEX_GEMINI_API_PRODUCT_ID)
  assert.equal(byName.get("Gemini Code Assist")?.status, "degraded")
  assert.equal(byName.get("Gemini Enterprise")?.status, "operational")
  assert.equal(byName.has("Google Compute Engine"), false)
})

test("mapGoogleCloud is operational when no Gemini incidents are open", async () => {
  const { incidents, products } = await loadFixtures()
  const closedOnly = incidents.filter((i) => i.end)
  const state = mapGoogleCloud(closedOnly, products)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.openIncidentCount, 0)
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].status, "resolved")
  assert.equal(state.components.every((c) => c.status === "operational"), true)
})

test("mapGoogleCloud ignores open incidents that do not touch Gemini", () => {
  const incidents: GoogleCloudIncident[] = [
    {
      id: "gce",
      external_desc: "Compute down",
      status_impact: "SERVICE_OUTAGE",
      affected_products: [{ id: "L3ggmi3Jy4xJmgodFA9K", title: "Google Compute Engine" }],
    },
  ]
  assert.equal(incidentAffectsGemini(incidents[0]), false)
  const state = mapGoogleCloud(incidents, [])
  assert.equal(state.status, "operational")
  assert.equal(state.incidents.length, 0)
  assert.equal(state.incidentTitle, null)
})

test("mapGoogleCloud synthesizes Gemini components when the catalog is missing", async () => {
  const { incidents } = await loadFixtures()
  const state = mapGoogleCloud(incidents, null)
  const ids = state.components.map((c) => c.externalId)
  assert.ok(ids.includes(VERTEX_GEMINI_API_PRODUCT_ID))
  assert.ok(ids.includes("deUeOEPYanfJ9w8cpyBJ"))
  assert.equal(ids.includes("L3ggmi3Jy4xJmgodFA9K"), false)
  assert.equal(
    state.components.find((c) => c.externalId === VERTEX_GEMINI_API_PRODUCT_ID)?.status,
    "partial_outage",
  )
})

test("mapGoogleCloudPlatform includes Compute Engine and ignores informational rollup", async () => {
  const { incidents, products } = await loadFixtures()
  const state = mapGoogleCloudPlatform(incidents, products)

  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Compute Engine zone outage in us-central1-b.")
  assert.equal(state.detail.openIncidentCount, 3)
  assert.ok(state.incidents.some((incident) => incident.externalId === "open-compute"))
  assert.ok(state.incidents.some((incident) => incident.externalId === "open-gemini-code-assist"))

  const byName = new Map(state.components.map((component) => [component.name, component]))
  assert.equal(byName.get("Google Compute Engine")?.status, "major_outage")
  assert.equal(byName.get("Gemini on Agent Platform")?.status, "partial_outage")
  assert.equal(byName.has("Gemini Code Assist"), false)
  assert.equal(byName.has("Gemini Enterprise"), false)
})

test("mapGoogleCloudPlatform stays operational when only informational incidents are open", () => {
  const incidents: GoogleCloudIncident[] = [
    {
      id: "info-only",
      external_desc: "Docs update",
      status_impact: "SERVICE_INFORMATION",
      affected_products: [{ id: "L3ggmi3Jy4xJmgodFA9K", title: "Google Compute Engine" }],
    },
  ]
  const state = mapGoogleCloudPlatform(incidents, [])
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 1)
  assert.equal(state.components.length, 0)
})

test("mapGoogleCloud floors unknown open impact at degraded, not operational", () => {
  const incidents: GoogleCloudIncident[] = [
    {
      id: "weird",
      external_desc: "Something odd on Gemini",
      status_impact: "NEW_KIND",
      affected_products: [{ id: VERTEX_GEMINI_API_PRODUCT_ID, title: "Vertex Gemini API" }],
    },
  ]
  const state = mapGoogleCloud(incidents, [])
  assert.equal(state.status, "degraded")
  assert.equal(state.incidents[0].status, "active")
})
