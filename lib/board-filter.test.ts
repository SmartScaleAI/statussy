import assert from "node:assert/strict"
import { test } from "node:test"

import {
  ALL_CATEGORY,
  distinctCategories,
  filterBoardServices,
  formatCategoryLabel,
  summarizeBoardItems,
} from "./board-filter.ts"

const items = [
  { name: "OpenAI", category: "ai", status: "operational" },
  { name: "Anthropic", category: "ai", status: "degraded" },
  { name: "Vercel", category: "hosting", status: "operational" },
]

test("distinctCategories is sorted and unique, without All", () => {
  assert.deepEqual(distinctCategories(items), ["ai", "hosting"])
  assert.deepEqual(
    distinctCategories([{ category: "ai" }, { category: "ai" }]),
    ["ai"]
  )
})

test("formatCategoryLabel: All + short codes uppercase", () => {
  assert.equal(formatCategoryLabel(ALL_CATEGORY), "All")
  assert.equal(formatCategoryLabel("ai"), "AI")
  assert.equal(formatCategoryLabel("hosting"), "Hosting")
})

test("All shows every service; category chiclet filters the registry field", () => {
  const all = filterBoardServices(items, "", ALL_CATEGORY)
  assert.equal(all.length, 3)

  const ai = filterBoardServices(items, "", "ai")
  assert.deepEqual(
    ai.map((item) => item.name),
    ["OpenAI", "Anthropic"]
  )
})

test("search intersects with the active category", () => {
  const allOpen = filterBoardServices(items, "open", ALL_CATEGORY)
  assert.deepEqual(
    allOpen.map((item) => item.name),
    ["OpenAI"]
  )

  const aiOpen = filterBoardServices(items, "open", "ai")
  assert.deepEqual(
    aiOpen.map((item) => item.name),
    ["OpenAI"]
  )

  const hostingOpen = filterBoardServices(items, "open", "hosting")
  assert.deepEqual(hostingOpen, [])

  const aiThropic = filterBoardServices(items, "  THROP  ", "ai")
  assert.deepEqual(
    aiThropic.map((item) => item.name),
    ["Anthropic"]
  )
})

test("search matches service name only (case-insensitive substring)", () => {
  const withExtra = [
    {
      name: "OpenAI",
      category: "ai",
      status: "operational",
      description: "anthropic competitor",
      slug: "anthropic-rival",
    },
  ]

  assert.deepEqual(
    filterBoardServices(withExtra, "anthropic", ALL_CATEGORY),
    []
  )
  assert.deepEqual(
    filterBoardServices(withExtra, "OPEN", ALL_CATEGORY).map(
      (item) => item.name
    ),
    ["OpenAI"]
  )
})

test("empty or whitespace query restores the category-scoped list", () => {
  assert.deepEqual(
    filterBoardServices(items, "   ", "ai").map((item) => item.name),
    ["OpenAI", "Anthropic"]
  )
})

test("summarizeBoardItems counts the visible filtered set", () => {
  const visible = filterBoardServices(items, "open", ALL_CATEGORY)
  assert.deepEqual(summarizeBoardItems(visible), {
    total: 1,
    operational: 1,
    issues: 0,
  })

  const none = filterBoardServices(items, "zzz", ALL_CATEGORY)
  assert.deepEqual(summarizeBoardItems(none), {
    total: 0,
    operational: 0,
    issues: 0,
  })

  const ai = filterBoardServices(items, "", "ai")
  assert.deepEqual(summarizeBoardItems(ai), {
    total: 2,
    operational: 1,
    issues: 1,
  })
})
