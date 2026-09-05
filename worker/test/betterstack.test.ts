import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  mapBetterstack,
  mapBetterstackStatus,
  type BetterstackIndex,
} from "../src/betterstack.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

async function loadFixture(): Promise<BetterstackIndex> {
  return JSON.parse(await readFile(join(FIXTURES, "betterstack-index.json"), "utf8"))
}

test("mapBetterstackStatus covers Better Stack page/resource statuses", () => {
  assert.equal(mapBetterstackStatus("operational"), "operational")
  assert.equal(mapBetterstackStatus("degraded"), "degraded")
  assert.equal(mapBetterstackStatus("DEGRADED_PERFORMANCE"), "degraded")
  assert.equal(mapBetterstackStatus("partial_outage"), "partial_outage")
  assert.equal(mapBetterstackStatus("downtime"), "major_outage")
  assert.equal(mapBetterstackStatus("down"), "major_outage")
  assert.equal(mapBetterstackStatus("maintenance"), "maintenance")
  assert.equal(mapBetterstackStatus("under_maintenance"), "maintenance")
  assert.equal(mapBetterstackStatus("something_new"), "unknown")
  assert.equal(mapBetterstackStatus(undefined), "unknown")
  assert.equal(mapBetterstackStatus(null), "unknown")
})

test("mapBetterstack parses the Together-shaped fixture with an open report", async () => {
  const index = await loadFixture()
  const state = mapBetterstack(index, "https://status.together.ai/")

  assert.equal(state.status, "degraded")
  assert.equal(state.detail.source, "betterstack")
  assert.equal(state.detail.aggregateState, "degraded")
  assert.equal(state.detail.companyName, "Together AI")
  assert.equal(state.detail.pageUpdatedAt, "2026-09-05T01:17:24.754Z")

  assert.equal(state.components.length, 5)
  const byName = new Map(state.components.map((c) => [c.name, c]))
  assert.equal(byName.get("Website")?.status, "operational")
  assert.equal(byName.get("API")?.status, "degraded")
  assert.equal(byName.get("Inference")?.status, "major_outage")
  assert.equal(byName.get("Playground")?.status, "maintenance")
  assert.equal(byName.get("Billing")?.status, "unknown")
  assert.equal(byName.get("Website")?.externalId, "8475065")
  assert.equal(byName.get("Website")?.position, 1)

  assert.equal(state.incidents.length, 2)
  const [open, resolved] = state.incidents
  assert.equal(open.title, "Elevated error rates on the API")
  assert.equal(open.status, "investigating")
  assert.equal(open.impact, "manual")
  assert.equal(open.startedAt, "2026-09-05T00:10:00.000Z")
  assert.equal(open.resolvedAt, null)
  assert.equal(open.url, "https://status.together.ai/incidents/941900")
  assert.equal(resolved.status, "resolved")
  assert.equal(resolved.resolvedAt, "2026-07-03T06:59:00.000Z")

  assert.equal(state.incidentTitle, "Elevated error rates on the API")
})

test("mapBetterstack handles an all-operational page with only resolved reports", () => {
  const index: BetterstackIndex = {
    data: {
      attributes: {
        company_name: "Hugging Face",
        aggregate_state: "operational",
        updated_at: "2026-09-05T01:17:23.111Z",
      },
    },
    included: [
      {
        id: "1",
        type: "status_page_resource",
        attributes: { public_name: "Hub", status: "operational", position: 1 },
      },
      {
        id: "2",
        type: "status_report",
        attributes: {
          title: "Hub unavailable",
          report_type: "manual",
          starts_at: "2026-07-16T08:30:00.000Z",
          ends_at: null,
          aggregate_state: "resolved",
        },
      },
    ],
  }
  const state = mapBetterstack(index, "https://status.huggingface.co")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].status, "resolved")
  assert.equal(state.incidents[0].resolvedAt, null)
  assert.equal(state.components.length, 1)
})

test("mapBetterstack ignores sections and status_updates", () => {
  const state = mapBetterstack(
    {
      data: { attributes: { aggregate_state: "operational" } },
      included: [
        { id: "s1", type: "status_page_section", attributes: { public_name: "Nope" } },
        { id: "u1", type: "status_update", attributes: { title: "Not a report" } },
      ],
    },
    "https://status.together.ai",
  )
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.incidentTitle, null)
})

test("mapBetterstack maps page-level downtime and maintenance", () => {
  assert.equal(
    mapBetterstack(
      { data: { attributes: { aggregate_state: "downtime" } } },
      "https://status.together.ai",
    ).status,
    "major_outage",
  )
  assert.equal(
    mapBetterstack(
      { data: { attributes: { aggregate_state: "maintenance" } } },
      "https://status.together.ai",
    ).status,
    "maintenance",
  )
})

test("mapBetterstack sorts reports newest-first and nulls unparseable dates", () => {
  const state = mapBetterstack(
    {
      data: { attributes: { aggregate_state: "degraded" } },
      included: [
        {
          id: "old",
          type: "status_report",
          attributes: {
            title: "Older",
            report_type: "manual",
            starts_at: "2026-08-01T00:00:00.000Z",
            aggregate_state: "investigating",
          },
        },
        {
          id: "bad",
          type: "status_report",
          attributes: {
            title: "Bad date",
            report_type: "manual",
            starts_at: "not a date",
            aggregate_state: "identified",
          },
        },
        {
          id: "new",
          type: "status_report",
          attributes: {
            title: "Newer",
            report_type: "manual",
            starts_at: "2026-09-04T12:00:00.000Z",
            aggregate_state: "monitoring",
          },
        },
      ],
    },
    "https://status.together.ai",
  )
  assert.deepEqual(
    state.incidents.map((i) => i.externalId),
    ["new", "old", "bad"],
  )
  assert.equal(state.incidents[2].startedAt, null)
  assert.equal(state.incidentTitle, "Newer")
})
