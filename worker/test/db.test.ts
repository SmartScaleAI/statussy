import assert from "node:assert/strict"
import { test } from "node:test"

import {
  POOL_CONNECTION_TIMEOUT_MS,
  POOL_MAX,
  POOL_QUERY_TIMEOUT_MS,
  POOL_STATEMENT_TIMEOUT_MS,
  resolvePoolConfig,
  resolveSsl,
} from "../src/db.js"

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

test("pool max follows fetch concurrency up to the cap", () => {
  const url = "postgres://user:pass@postgres.railway.internal:5432/railway"
  assert.equal(resolvePoolConfig(url, 8).max, 8)
  assert.equal(resolvePoolConfig(url, 40).max, POOL_MAX)
  assert.equal(resolvePoolConfig(url).max, POOL_MAX)
})

test("pool checkout and statements cannot wait forever", () => {
  const config = resolvePoolConfig(
    "postgres://user:pass@localhost:5432/statussy",
    20,
  )
  assert.equal(config.connectionTimeoutMillis, POOL_CONNECTION_TIMEOUT_MS)
  assert.ok((config.connectionTimeoutMillis ?? 0) > 0)
  assert.equal(config.statement_timeout, POOL_STATEMENT_TIMEOUT_MS)
  assert.ok((config.statement_timeout ?? 0) > 0)
  assert.equal(config.query_timeout, POOL_QUERY_TIMEOUT_MS)
  assert.ok((config.query_timeout ?? 0) >= (config.statement_timeout ?? 0))
  assert.equal(config.ssl, false)
})
