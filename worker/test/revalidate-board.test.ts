import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BOARD_REVALIDATE_PATH,
  boardRevalidateEndpoint,
  ensureBoardRevalidateSecret,
  purgeBoardCache,
} from "../src/revalidate-board.js"

test("board revalidate endpoint is the app route on the public origin", () => {
  assert.equal(
    boardRevalidateEndpoint("https://www.statussy.com"),
    `https://www.statussy.com${BOARD_REVALIDATE_PATH}`
  )
  assert.equal(
    boardRevalidateEndpoint("https://www.statussy.com/"),
    `https://www.statussy.com${BOARD_REVALIDATE_PATH}`
  )
})

test("ensureBoardRevalidateSecret reuses the stored bearer", async () => {
  const calls: string[] = []
  const pool = {
    async query(sql: string) {
      calls.push(sql)
      return { rows: [{ secret: "a".repeat(64) }] }
    },
  }
  const secret = await ensureBoardRevalidateSecret(pool)
  assert.equal(secret, "a".repeat(64))
  assert.equal(calls.length, 1)
})

test("ensureBoardRevalidateSecret inserts once when the row is missing", async () => {
  let stored: string | null = null
  const pool = {
    async query(sql: string, values?: unknown[]) {
      if (sql.startsWith("INSERT")) {
        stored = String(values?.[0] ?? "")
        return { rows: [] }
      }
      return stored ? { rows: [{ secret: stored }] } : { rows: [] }
    },
  }
  const secret = await ensureBoardRevalidateSecret(pool)
  assert.match(secret, /^[0-9a-f]{64}$/)
  assert.equal(stored, secret)
})

test("purgeBoardCache posts the bearer and does not follow redirects", async () => {
  let seen: { url: string; init: RequestInit } | null = null
  const result = await purgeBoardCache({
    publicSiteUrl: "https://www.statussy.com",
    secret: "b".repeat(64),
    fetchImpl: async (url, init) => {
      seen = { url: String(url), init: init ?? {} }
      return new Response(null, { status: 200 })
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.status, 200)
  assert.equal(seen?.url, "https://www.statussy.com/api/revalidate-board")
  assert.equal(seen?.init.method, "POST")
  assert.equal(seen?.init.redirect, "manual")
  const headers = new Headers(seen?.init.headers)
  assert.equal(headers.get("authorization"), `Bearer ${"b".repeat(64)}`)
})

test("purgeBoardCache reports a non-ok status without throwing", async () => {
  const result = await purgeBoardCache({
    publicSiteUrl: "https://www.statussy.com",
    secret: "c".repeat(64),
    fetchImpl: async () => new Response(null, { status: 401 }),
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
})
