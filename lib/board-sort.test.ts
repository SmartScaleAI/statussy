import assert from "node:assert/strict"
import { test } from "node:test"

import { selectFavoriteServices } from "./favorite-services.ts"
import {
  DEFAULT_SORT_BY,
  parseHealthLabel,
  parseSortBy,
  resolveSortHealth,
  serviceHasIssues,
  sortBoardServices,
  type BoardSortItem,
} from "./board-sort.ts"

function item(
  partial: Partial<BoardSortItem> & Pick<BoardSortItem, "id" | "name">
): BoardSortItem {
  return {
    status: "operational",
    healthPct: 100,
    hasActiveIncident: false,
    ...partial,
  }
}

const mixed: BoardSortItem[] = [
  item({ id: "openai", name: "OpenAI", healthPct: 100 }),
  item({
    id: "gemini",
    name: "Google Gemini",
    status: "degraded",
    healthPct: 94.1,
  }),
  item({
    id: "deepseek",
    name: "DeepSeek",
    status: "major_outage",
    healthPct: 0,
    hasActiveIncident: true,
  }),
  item({
    id: "openrouter",
    name: "OpenRouter",
    status: "maintenance",
    healthPct: 80,
    hasActiveIncident: true,
  }),
  item({ id: "anthropic", name: "Anthropic", healthPct: 100 }),
]

test("parseSortBy defaults to Issues first", () => {
  assert.equal(parseSortBy(null), DEFAULT_SORT_BY)
  assert.equal(parseSortBy(undefined), "issues-first")
  assert.equal(parseSortBy("nope"), "issues-first")
  assert.equal(parseSortBy("name"), "name")
  assert.equal(parseSortBy("health"), "health")
  assert.equal(parseSortBy("issues-first"), "issues-first")
})

test("parseHealthLabel reads formatHealth percents", () => {
  assert.equal(parseHealthLabel("94.1%"), 94.1)
  assert.equal(parseHealthLabel("100.00%"), 100)
  assert.equal(parseHealthLabel(null), null)
  assert.equal(parseHealthLabel("—"), null)
})

test("serviceHasIssues: non-operational or active incident", () => {
  assert.equal(
    serviceHasIssues({ status: "operational", hasActiveIncident: false }),
    false
  )
  assert.equal(
    serviceHasIssues({ status: "operational", hasActiveIncident: true }),
    true
  )
  assert.equal(
    serviceHasIssues({ status: "degraded", hasActiveIncident: false }),
    true
  )
  assert.equal(
    serviceHasIssues({ status: "unknown", hasActiveIncident: false }),
    true
  )
})

test("Issues first: issues above healthy, Name A–Z within each group", () => {
  assert.deepEqual(
    sortBoardServices(mixed, "issues-first").map((row) => row.name),
    ["DeepSeek", "Google Gemini", "OpenRouter", "Anthropic", "OpenAI"]
  )
})

test("Name A–Z is alphabetical by service name", () => {
  assert.deepEqual(
    sortBoardServices(mixed, "name").map((row) => row.name),
    ["Anthropic", "DeepSeek", "Google Gemini", "OpenAI", "OpenRouter"]
  )
})

test("Health % is lowest first; ties by Name A–Z", () => {
  const tied = [
    item({ id: "b", name: "Beta", healthPct: 50, status: "degraded" }),
    item({ id: "a", name: "Alpha", healthPct: 50, status: "degraded" }),
    item({ id: "c", name: "Clear", healthPct: 100 }),
    item({ id: "z", name: "Zero", healthPct: 0, status: "major_outage" }),
  ]
  assert.deepEqual(
    sortBoardServices(tied, "health").map((row) => row.name),
    ["Zero", "Alpha", "Beta", "Clear"]
  )
})

test("missing healthPct uses operational → 100, else 0", () => {
  assert.equal(
    resolveSortHealth({ status: "operational", healthPct: null }),
    100
  )
  assert.equal(resolveSortHealth({ status: "degraded", healthPct: null }), 0)
  assert.equal(
    resolveSortHealth({ status: "operational", healthPct: 99.2 }),
    99.2
  )

  const fallback = [
    item({
      id: "live",
      name: "Live Low",
      status: "degraded",
      healthPct: 10,
    }),
    item({
      id: "mock-down",
      name: "Mock Down",
      status: "major_outage",
      healthPct: null,
    }),
    item({
      id: "mock-up",
      name: "Mock Up",
      status: "operational",
      healthPct: null,
    }),
  ]
  assert.deepEqual(
    sortBoardServices(fallback, "health").map((row) => row.name),
    ["Mock Down", "Live Low", "Mock Up"]
  )
})

test("My Services: favorite subset then the shared board sort", () => {
  const pinned = selectFavoriteServices(mixed, [
    "openai",
    "deepseek",
    "anthropic",
  ])
  assert.deepEqual(
    sortBoardServices(pinned, "issues-first").map((row) => row.name),
    ["DeepSeek", "Anthropic", "OpenAI"]
  )
})

test("sort composes after an AND-filtered visible set", () => {
  const visible = mixed.filter((row) => row.name.toLowerCase().includes("o"))
  assert.deepEqual(
    sortBoardServices(visible, "issues-first").map((row) => row.name),
    ["Google Gemini", "OpenRouter", "Anthropic", "OpenAI"]
  )
})
