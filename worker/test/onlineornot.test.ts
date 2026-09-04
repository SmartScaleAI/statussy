import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  mapOnlineOrNot,
  mapOnlineOrNotComponentStatus,
  mapOnlineOrNotDescription,
  mapOnlineOrNotImpact,
  type OnlineOrNotSummary,
} from "../src/onlineornot.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

async function loadFixture(): Promise<OnlineOrNotSummary> {
  return JSON.parse(await readFile(join(FIXTURES, "onlineornot-summary.json"), "utf8"))
}

test("mapOnlineOrNotComponentStatus covers all OnlineOrNot component statuses", () => {
  assert.equal(mapOnlineOrNotComponentStatus("OPERATIONAL"), "operational")
  assert.equal(mapOnlineOrNotComponentStatus("NO_IMPACT"), "operational")
  assert.equal(mapOnlineOrNotComponentStatus("DEGRADED_PERFORMANCE"), "degraded")
  assert.equal(mapOnlineOrNotComponentStatus("PARTIAL_OUTAGE"), "partial_outage")
  assert.equal(mapOnlineOrNotComponentStatus("MAJOR_OUTAGE"), "major_outage")
  assert.equal(mapOnlineOrNotComponentStatus("MAINTENANCE"), "maintenance")
  assert.equal(mapOnlineOrNotComponentStatus("operational"), "operational")
  assert.equal(mapOnlineOrNotComponentStatus("SOMETHING_NEW"), "unknown")
  assert.equal(mapOnlineOrNotComponentStatus(undefined), "unknown")
})

test("mapOnlineOrNotImpact normalizes impact labels", () => {
  assert.equal(mapOnlineOrNotImpact("NO_IMPACT"), "none")
  assert.equal(mapOnlineOrNotImpact("MINOR"), "minor")
  assert.equal(mapOnlineOrNotImpact("MAJOR"), "major")
  assert.equal(mapOnlineOrNotImpact("CRITICAL"), "critical")
  assert.equal(mapOnlineOrNotImpact(null), null)
  assert.equal(mapOnlineOrNotImpact(undefined), null)
})

test("mapOnlineOrNotDescription maps recognizable phrases", () => {
  assert.equal(mapOnlineOrNotDescription("All Systems Operational"), "operational")
  assert.equal(mapOnlineOrNotDescription("Degraded Performance"), "degraded")
  assert.equal(mapOnlineOrNotDescription("Partial System Outage"), "partial_outage")
  assert.equal(mapOnlineOrNotDescription("Major System Outage"), "major_outage")
  assert.equal(mapOnlineOrNotDescription("Under Maintenance"), "maintenance")
  assert.equal(mapOnlineOrNotDescription("Something else entirely"), "unknown")
  assert.equal(mapOnlineOrNotDescription(undefined), "unknown")
})

test("mapOnlineOrNot parses the OpenRouter fixture summary", async () => {
  const summary = await loadFixture()
  const state = mapOnlineOrNot(summary, "https://status.openrouter.ai")

  assert.equal(state.status, "partial_outage")
  assert.equal(state.detail.source, "onlineornot")
  assert.equal(state.detail.description, "Partial System Outage")
  assert.equal(state.detail.statusPageId, "bLYZeyaq")

  assert.equal(state.components.length, 5)
  const byName = new Map(state.components.map((c) => [c.name, c]))
  assert.equal(byName.get("Chat (/api/v1/chat/completions)")?.status, "partial_outage")
  assert.equal(byName.get("Models (/api/v1/models)")?.status, "operational")
  assert.equal(byName.get("Generation (/api/v1/generation)")?.status, "degraded")
  assert.equal(byName.get("Homepage (us east)")?.status, "maintenance")
  assert.equal(byName.get("Homepage (us west)")?.status, "unknown")
  assert.equal(byName.get("Chat (/api/v1/chat/completions)")?.externalId, "oRWryVpo1B24")
  // No vendor position field; feed order is preserved.
  assert.equal(byName.get("Chat (/api/v1/chat/completions)")?.position, 0)
  assert.equal(byName.get("Homepage (us west)")?.position, 4)

  assert.equal(state.incidents.length, 2)
  const [major, noImpact] = state.incidents
  assert.equal(major.title, "Degraded chat completions API")
  assert.equal(major.status, "active")
  assert.equal(major.impact, "major")
  assert.equal(major.startedAt, "2026-09-04T18:27:28.310Z")
  assert.equal(major.resolvedAt, null)
  assert.equal(major.url, "https://status.openrouter.ai/incidents/RJ0mNKO5Arwy")
  assert.equal(noImpact.impact, "none")
  // `started` is null; falls back to created_at.
  assert.equal(noImpact.startedAt, "2026-09-04T16:00:00.000Z")

  // The first active incident becomes the snapshot headline.
  assert.equal(state.incidentTitle, "Degraded chat completions API")
})

test("mapOnlineOrNot handles an all-operational page with no incidents", () => {
  const summary: OnlineOrNotSummary = {
    success: true,
    result: {
      status: { description: "All Systems Operational" },
      components: [{ id: "abc", name: "API", status: "OPERATIONAL" }],
      active_incidents: [],
    },
  }
  const state = mapOnlineOrNot(summary, "https://status.openrouter.ai/")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.components.length, 1)
})

test("mapOnlineOrNot falls back to worst component status for unknown descriptions", () => {
  const summary: OnlineOrNotSummary = {
    success: true,
    result: {
      status: { description: "Some new phrasing" },
      components: [
        { id: "a", name: "API", status: "OPERATIONAL" },
        { id: "b", name: "Chat", status: "MAJOR_OUTAGE" },
      ],
      active_incidents: [],
    },
  }
  const state = mapOnlineOrNot(summary, "https://status.openrouter.ai")
  assert.equal(state.status, "major_outage")
})

test("mapOnlineOrNot escalates when components are worse than the description", () => {
  const summary: OnlineOrNotSummary = {
    success: true,
    result: {
      status: { description: "All Systems Operational" },
      components: [{ id: "a", name: "Chat", status: "DEGRADED_PERFORMANCE" }],
      active_incidents: [],
    },
  }
  const state = mapOnlineOrNot(summary, "https://status.openrouter.ai")
  assert.equal(state.status, "degraded")
})

test("mapOnlineOrNot returns unknown when nothing yields a signal", () => {
  const state = mapOnlineOrNot({ success: true, result: {} }, "https://status.openrouter.ai")
  assert.equal(state.status, "unknown")
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.incidentTitle, null)
})
