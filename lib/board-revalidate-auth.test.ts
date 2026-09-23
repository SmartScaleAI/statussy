import assert from "node:assert/strict"
import { test } from "node:test"

import {
  bearerToken,
  boardRevalidateSecretsMatch,
} from "./board-revalidate-auth.ts"

const SECRET = "ab".repeat(32)

test("bearer token is the credential after Bearer", () => {
  assert.equal(bearerToken(`Bearer ${SECRET}`), SECRET)
  assert.equal(bearerToken("Bearer"), "")
  assert.equal(bearerToken(null), "")
  assert.equal(bearerToken(`Basic ${SECRET}`), "")
})

test("secret compare accepts only the same bearer", () => {
  assert.equal(boardRevalidateSecretsMatch(SECRET, SECRET), true)
  assert.equal(boardRevalidateSecretsMatch(`${SECRET}x`, SECRET), false)
  assert.equal(boardRevalidateSecretsMatch(SECRET.slice(0, -1), SECRET), false)
  assert.equal(boardRevalidateSecretsMatch("", SECRET), false)
  assert.equal(boardRevalidateSecretsMatch("nope", SECRET), false)
})
