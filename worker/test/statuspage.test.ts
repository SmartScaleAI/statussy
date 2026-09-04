import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  mapComponentStatus,
  mapIndicator,
  mapStatuspage,
  type StatuspageIncident,
  type StatuspageSummary,
} from "../src/statuspage.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

async function loadFixtures(): Promise<{
  summary: StatuspageSummary
  incidents: StatuspageIncident[]
}> {
  const summary = JSON.parse(await readFile(join(FIXTURES, "summary.json"), "utf8"))
  const incidentsBody = JSON.parse(await readFile(join(FIXTURES, "incidents.json"), "utf8"))
  return { summary, incidents: incidentsBody.incidents }
}

test("mapIndicator covers all Statuspage indicators", () => {
  assert.equal(mapIndicator("none"), "operational")
  assert.equal(mapIndicator("minor"), "degraded")
  assert.equal(mapIndicator("major"), "partial_outage")
  assert.equal(mapIndicator("critical"), "major_outage")
  assert.equal(mapIndicator("maintenance"), "maintenance")
  assert.equal(mapIndicator("bogus"), "unknown")
  assert.equal(mapIndicator(undefined), "unknown")
})

test("mapComponentStatus covers all Statuspage component statuses", () => {
  assert.equal(mapComponentStatus("operational"), "operational")
  assert.equal(mapComponentStatus("degraded_performance"), "degraded")
  assert.equal(mapComponentStatus("partial_outage"), "partial_outage")
  assert.equal(mapComponentStatus("major_outage"), "major_outage")
  assert.equal(mapComponentStatus("under_maintenance"), "maintenance")
  assert.equal(mapComponentStatus("something_new"), "unknown")
  assert.equal(mapComponentStatus(undefined), "unknown")
})

test("mapStatuspage parses the OpenAI fixture summary", async () => {
  const { summary, incidents } = await loadFixtures()
  const state = mapStatuspage(summary, incidents, "https://status.openai.com")

  assert.equal(state.status, "partial_outage")
  assert.equal(state.detail.source, "statuspage")
  assert.equal(state.detail.indicator, "major")
  assert.equal(state.detail.description, "Partial System Outage")
  assert.equal(state.detail.pageUpdatedAt, "2026-09-04T10:46:54Z")

  assert.equal(state.components.length, 6)
  const byName = new Map(state.components.map((c) => [c.name, c]))
  assert.equal(byName.get("Images")?.status, "operational")
  assert.equal(byName.get("Responses")?.status, "partial_outage")
  assert.equal(byName.get("Login")?.status, "degraded")
  assert.equal(byName.get("Audio")?.status, "major_outage")
  assert.equal(byName.get("Files")?.status, "maintenance")
  assert.equal(byName.get("FedRAMP")?.status, "unknown")
  assert.equal(byName.get("Images")?.externalId, "01JMXBRMFE4MAP2BHSJNZ787WX")
  assert.equal(byName.get("Images")?.position, 0)

  assert.equal(state.incidents.length, 2)
  const [open, resolved] = state.incidents
  assert.equal(open.title, "Elevated error rates on Responses API")
  assert.equal(open.status, "investigating")
  assert.equal(open.impact, "major")
  assert.equal(open.startedAt, "2026-09-04T12:00:00Z")
  assert.equal(open.resolvedAt, null)
  assert.equal(open.url, "https://status.openai.com/incidents/01M1QAAAAAEEYEREC54HNAHY99")
  assert.equal(resolved.status, "resolved")
  assert.equal(resolved.resolvedAt, "2026-09-04T10:46:54Z")

  // The open (unresolved) incident becomes the snapshot headline.
  assert.equal(state.incidentTitle, "Elevated error rates on Responses API")
})

test("mapStatuspage handles an all-operational page with no incidents", () => {
  const summary: StatuspageSummary = {
    page: { url: "https://status.openai.com/" },
    status: { indicator: "none", description: "All Systems Operational" },
    components: [{ id: "abc", name: "API", status: "operational", position: 0 }],
  }
  const state = mapStatuspage(summary, [], "https://status.openai.com")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.components.length, 1)
})

test("mapStatuspage ignores resolved incidents for the headline", async () => {
  const { summary, incidents } = await loadFixtures()
  const resolvedOnly = incidents.filter((i) => i.status === "resolved")
  const state = mapStatuspage(summary, resolvedOnly, "https://status.openai.com")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 1)
})

test("mapStatuspage prefers vendor shortlink for incident url", () => {
  const incident: StatuspageIncident = {
    id: "x1",
    name: "Thing broke",
    status: "identified",
    shortlink: "https://stspg.io/abc",
    created_at: "2026-09-04T12:00:00Z",
  }
  const state = mapStatuspage(
    { status: { indicator: "minor" } },
    [incident],
    "https://status.openai.com",
  )
  assert.equal(state.incidents[0].url, "https://stspg.io/abc")
  assert.equal(state.status, "degraded")
})
