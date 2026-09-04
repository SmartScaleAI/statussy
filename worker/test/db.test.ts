import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveSsl } from "../src/db.js"

test("private Railway hostname stays plaintext", () => {
  assert.equal(
    resolveSsl("postgres://user:pass@postgres.railway.internal:5432/railway"),
    false
  )
})

test("localhost stays plaintext", () => {
  assert.equal(resolveSsl("postgres://user:pass@localhost:5432/statussy"), false)
})

test("public Railway TCP proxy gets unverified TLS", () => {
  assert.deepEqual(
    resolveSsl("postgres://user:pass@altaria.proxy.rlwy.net:24195/railway"),
    { rejectUnauthorized: false }
  )
})

test("explicit sslmode=require gets unverified TLS even on private hosts", () => {
  assert.deepEqual(
    resolveSsl(
      "postgres://user:pass@postgres.railway.internal:5432/railway?sslmode=require"
    ),
    { rejectUnauthorized: false }
  )
})

test("explicit sslmode=disable stays plaintext even on public hosts", () => {
  assert.equal(
    resolveSsl(
      "postgres://user:pass@altaria.proxy.rlwy.net:24195/railway?sslmode=disable"
    ),
    false
  )
})

test("unparseable URL defers the error to pg", () => {
  assert.equal(resolveSsl("not a url"), false)
})
