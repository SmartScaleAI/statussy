import assert from "node:assert/strict"
import { test } from "node:test"

import {
  ALL_CATEGORY,
  distinctCategories,
  filterBoardServices,
  formatCategoryLabel,
} from "./board-filter.ts"

const items = [
  { name: "OpenAI", category: "ai" },
  { name: "Anthropic", category: "ai" },
  { name: "Vercel", category: "hosting" },
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
