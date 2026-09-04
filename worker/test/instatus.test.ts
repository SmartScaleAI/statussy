import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  mapInstatus,
  mapInstatusComponentStatus,
  type InstatusComponent,
  type InstatusSummary,
} from "../src/instatus.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

async function loadFixtures(): Promise<{
  summary: InstatusSummary
  components: InstatusComponent[]
}> {
  const summary = JSON.parse(await readFile(join(FIXTURES, "instatus-summary.json"), "utf8"))
  const componentsBody = JSON.parse(
    await readFile(join(FIXTURES, "instatus-components.json"), "utf8"),
  )
  return { summary, components: componentsBody.components }
}

test("mapInstatusComponentStatus covers all Instatus statuses", () => {
  assert.equal(mapInstatusComponentStatus("OPERATIONAL"), "operational")
  assert.equal(mapInstatusComponentStatus("DEGRADEDPERFORMANCE"), "degraded")
  assert.equal(mapInstatusComponentStatus("PARTIALOUTAGE"), "partial_outage")
  assert.equal(mapInstatusComponentStatus("MAJOROUTAGE"), "major_outage")
  assert.equal(mapInstatusComponentStatus("UNDERMAINTENANCE"), "maintenance")
  assert.equal(mapInstatusComponentStatus("SOMETHINGNEW"), "unknown")
  assert.equal(mapInstatusComponentStatus(undefined), "unknown")
  assert.equal(mapInstatusComponentStatus(null), "unknown")
})

test("mapInstatus parses the Perplexity-shaped fixture with an active incident", async () => {
  const { summary, components } = await loadFixtures()
  const state = mapInstatus(summary, components)

  // HASISSUES + PARTIALOUTAGE incident/component -> partial_outage overall.
  assert.equal(state.status, "partial_outage")
  assert.equal(state.detail.source, "instatus")
  assert.equal(state.detail.pageStatus, "HASISSUES")
  assert.equal(state.detail.pageUrl, "https://status.perplexity.com")

  assert.equal(state.components.length, 3)
  const byName = new Map(state.components.map((c) => [c.name, c]))
  assert.equal(byName.get("Website")?.status, "operational")
  assert.equal(byName.get("API")?.status, "partial_outage")
  assert.equal(byName.get("Computer")?.status, "operational")
  assert.equal(byName.get("Website")?.externalId, "clyi6jhgg31469ihojbwbsmeeg")
  assert.equal(byName.get("Website")?.position, 0)
  assert.equal(byName.get("API")?.position, 1)

  assert.equal(state.incidents.length, 1)
  const [incident] = state.incidents
  assert.equal(incident.externalId, "cm0incident0001aaaaaaaaaaa")
  assert.equal(incident.title, "Elevated error rates on the API")
  assert.equal(incident.status, "investigating")
  assert.equal(incident.impact, "PARTIALOUTAGE")
  assert.equal(incident.url, "https://status.perplexity.com/incident/cm0incident0001aaaaaaaaaaa")
  assert.equal(incident.startedAt, "2026-09-04T12:00:00.000Z")
  assert.equal(incident.resolvedAt, null)

  // The active incident becomes the snapshot headline.
  assert.equal(state.incidentTitle, "Elevated error rates on the API")
})

test("mapInstatus handles the live all-operational shape (no incident keys)", () => {
  // Matches status.perplexity.com/summary.json when everything is UP:
  // summary carries only `page`, with no activeIncidents/activeMaintenances.
  const summary: InstatusSummary = {
    page: { name: "Perplexity", url: "https://status.perplexity.com", status: "UP" },
  }
  const components: InstatusComponent[] = [
    { id: "abc", name: "Website", status: "OPERATIONAL", group: null },
    { id: "def", name: "API", status: "OPERATIONAL", group: null },
  ]
  const state = mapInstatus(summary, components)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.components.length, 2)
  assert.equal(state.detail.pageStatus, "UP")
})

test("mapInstatus maps UNDERMAINTENANCE to maintenance", () => {
  const state = mapInstatus(
    { page: { status: "UNDERMAINTENANCE" } },
    [{ id: "abc", name: "API", status: "UNDERMAINTENANCE" }],
  )
  assert.equal(state.status, "maintenance")
})

test("mapInstatus floors HASISSUES at degraded when nothing maps", () => {
  const state = mapInstatus(
    { page: { status: "HASISSUES" }, activeIncidents: [] },
    [{ id: "abc", name: "API", status: "OPERATIONAL" }],
  )
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, null)
})

test("mapInstatus takes the worst signal across incidents and components", () => {
  const state = mapInstatus(
    {
      page: { status: "HASISSUES" },
      activeIncidents: [
        {
          id: "i1",
          name: "Degraded performance",
          status: "MONITORING",
          impact: "DEGRADEDPERFORMANCE",
        },
      ],
    },
    [{ id: "abc", name: "API", status: "MAJOROUTAGE" }],
  )
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "Degraded performance")
  assert.equal(state.incidents[0].status, "monitoring")
})

test("mapInstatus maps an unknown page status to unknown", () => {
  const state = mapInstatus({ page: { status: "SOMETHINGELSE" } }, [])
  assert.equal(state.status, "unknown")
})

test("mapInstatus normalizes timestamps and nulls unparseable ones", () => {
  const state = mapInstatus(
    {
      page: { status: "HASISSUES" },
      activeIncidents: [
        { id: "i1", name: "A", status: "INVESTIGATING", started: "not a date" },
        { id: "i2", name: "B", status: "IDENTIFIED", started: "2026-09-04T10:00:00.000Z" },
      ],
    },
    [],
  )
  assert.equal(state.incidents[0].startedAt, null)
  assert.equal(state.incidents[1].startedAt, "2026-09-04T10:00:00.000Z")
})
