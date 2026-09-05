import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseFavoriteServiceIds,
  selectFavoriteServices,
  serializeFavoriteServiceIds,
  toggleFavoriteServiceId,
} from "./favorite-services.ts"

test("parseFavoriteServiceIds reads a string id list", () => {
  assert.deepEqual(parseFavoriteServiceIds('["openai","anthropic"]'), [
    "openai",
    "anthropic",
  ])
})

test("parseFavoriteServiceIds ignores junk, blanks, and duplicates", () => {
  assert.deepEqual(parseFavoriteServiceIds(null), [])
  assert.deepEqual(parseFavoriteServiceIds("{"), [])
  assert.deepEqual(parseFavoriteServiceIds('{"openai":true}'), [])
  assert.deepEqual(
    parseFavoriteServiceIds('["openai",1,""," openai ","openai"]'),
    ["openai"]
  )
})

test("toggleFavoriteServiceId adds then removes, preserving insertion order", () => {
  const added = toggleFavoriteServiceId(["openai"], "anthropic")
  assert.deepEqual(added, ["openai", "anthropic"])
  assert.deepEqual(toggleFavoriteServiceId(added, "openai"), ["anthropic"])
})

test("selectFavoriteServices uses stable id order and drops unknown ids", () => {
  const items = [
    { id: "xai", name: "xAI" },
    { id: "openai", name: "OpenAI" },
    { id: "anthropic", name: "Anthropic" },
  ]
  assert.deepEqual(
    selectFavoriteServices(items, ["openai", "missing", "xai"]),
    [
      { id: "openai", name: "OpenAI" },
      { id: "xai", name: "xAI" },
    ]
  )
})

test("serializeFavoriteServiceIds round-trips through parse", () => {
  const ids = ["groq", "mistral"]
  assert.deepEqual(
    parseFavoriteServiceIds(serializeFavoriteServiceIds(ids)),
    ids
  )
})
