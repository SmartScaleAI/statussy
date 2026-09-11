import assert from "node:assert/strict"
import { test } from "node:test"

import {
  RECENTLY_ADDED_LIMIT,
  formatAddedDate,
  selectRecentlyAdded,
  toAddedTimestamp,
} from "./recently-added.ts"

const catalog = new Map([
  ["openai", "OpenAI"],
  ["anthropic", "Anthropic"],
  ["groq", "Groq"],
  ["mistral", "Mistral AI"],
  ["xai", "xAI"],
  ["cohere", "Cohere"],
  ["perplexity", "Perplexity"],
])

test("formatAddedDate is a short UTC calendar date", () => {
  assert.equal(
    formatAddedDate(new Date("2026-09-10T21:15:00.000Z")),
    "Sep 10, 2026"
  )
})

test("toAddedTimestamp accepts Date and ISO, rejects junk", () => {
  const date = new Date("2026-09-10T00:00:00.000Z")
  assert.equal(toAddedTimestamp(date)?.toISOString(), date.toISOString())
  assert.equal(
    toAddedTimestamp("2026-09-10T00:00:00.000Z")?.toISOString(),
    date.toISOString()
  )
  assert.equal(toAddedTimestamp("not a date"), null)
  assert.equal(toAddedTimestamp(undefined), null)
  assert.equal(toAddedTimestamp(new Date("invalid")), null)
})

test("selectRecentlyAdded keeps newest catalog rows and catalog names", () => {
  const selected = selectRecentlyAdded(
    [
      {
        id: "openai",
        name: "DB OpenAI",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "groq",
        name: "DB Groq",
        createdAt: "2026-09-10T12:00:00.000Z",
      },
      {
        id: "not-in-catalog",
        name: "Ghost",
        createdAt: "2026-09-11T00:00:00.000Z",
      },
      {
        id: "anthropic",
        name: "DB Anthropic",
        createdAt: "2026-09-09T00:00:00.000Z",
      },
    ],
    catalog
  )
  assert.deepEqual(
    selected.map((item) => item.id),
    ["groq", "anthropic", "openai"]
  )
  assert.equal(selected[0]?.name, "Groq")
})

test("selectRecentlyAdded drops rows without a real created_at", () => {
  const selected = selectRecentlyAdded(
    [
      { id: "groq", name: "Groq", createdAt: "not a date" },
      {
        id: "openai",
        name: "OpenAI",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    catalog
  )
  assert.deepEqual(
    selected.map((item) => item.id),
    ["openai"]
  )
})

test("selectRecentlyAdded caps at six and ties break by id", () => {
  const sameInstant = "2026-09-10T00:00:00.000Z"
  const selected = selectRecentlyAdded(
    [
      { id: "xai", name: "xAI", createdAt: sameInstant },
      { id: "openai", name: "OpenAI", createdAt: sameInstant },
      { id: "mistral", name: "Mistral AI", createdAt: sameInstant },
      { id: "groq", name: "Groq", createdAt: sameInstant },
      { id: "cohere", name: "Cohere", createdAt: sameInstant },
      { id: "anthropic", name: "Anthropic", createdAt: sameInstant },
      { id: "perplexity", name: "Perplexity", createdAt: sameInstant },
    ],
    catalog
  )
  assert.equal(selected.length, RECENTLY_ADDED_LIMIT)
  assert.deepEqual(
    selected.map((item) => item.id),
    ["anthropic", "cohere", "groq", "mistral", "openai", "perplexity"]
  )
})
