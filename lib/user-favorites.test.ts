import assert from "node:assert/strict"
import { test } from "node:test"

import { isCatalogServiceId, parseServiceId } from "./user-favorites.ts"

test("parseServiceId accepts catalog slugs only", () => {
  assert.equal(parseServiceId("openai"), "openai")
  assert.equal(parseServiceId("  openai  "), "openai")
  assert.equal(parseServiceId("not-a-real-service"), null)
  assert.equal(parseServiceId(""), null)
  assert.equal(parseServiceId(1), null)
})

test("isCatalogServiceId matches board slugs", () => {
  assert.equal(isCatalogServiceId("openai"), true)
  assert.equal(isCatalogServiceId("anthropic"), true)
  assert.equal(isCatalogServiceId("missing"), false)
})
