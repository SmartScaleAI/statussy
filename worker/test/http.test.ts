import assert from "node:assert/strict"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import test from "node:test"
import {
  clearValidatorCache,
  drainConditionalFetchStats,
  fetchBodyConditional,
  fetchJsonConditional,
} from "../src/http.js"
import { fetchStatuspageState } from "../src/statuspage.js"

const OPTIONS = { timeoutMs: 5_000, userAgent: "statussy-test" }
const ETAG = '"v1"'
const LAST_MODIFIED = "Mon, 01 Sep 2026 00:00:00 GMT"

type SeenRequest = { url: string; ifNoneMatch?: string; ifModifiedSince?: string }

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

/** Statuspage-style server: full body with validators, 304 on a match. */
function statuspageStyleServer(seen: SeenRequest[]): Server {
  return createServer((req, res) => {
    seen.push({
      url: req.url ?? "",
      ifNoneMatch: req.headers["if-none-match"] as string | undefined,
      ifModifiedSince: req.headers["if-modified-since"] as string | undefined,
    })
    if (req.headers["if-none-match"] === ETAG) {
      res.writeHead(304)
      res.end()
      return
    }
    const body =
      req.url === "/api/v2/summary.json"
        ? {
            page: { id: "p1", name: "Test", updated_at: "2026-09-07T00:00:00Z" },
            status: { indicator: "none", description: "All Systems Operational" },
            components: [
              { id: "c1", name: "API", status: "operational", position: 1 },
            ],
          }
        : { incidents: [] }
    res.writeHead(200, {
      "content-type": "application/json",
      etag: ETAG,
      "last-modified": LAST_MODIFIED,
    })
    res.end(JSON.stringify(body))
  })
}

test("conditional GET sends validators and reuses the cached body on 304", async () => {
  clearValidatorCache()
  drainConditionalFetchStats()
  const seen: SeenRequest[] = []
  const server = statuspageStyleServer(seen)
  const origin = await listen(server)
  try {
    const url = `${origin}/api/v2/summary.json`
    const first = await fetchJsonConditional<{ status: { indicator: string } }>(url, OPTIONS)
    assert.equal(first.status.indicator, "none")
    assert.equal(seen[0]?.ifNoneMatch, undefined)
    assert.equal(seen[0]?.ifModifiedSince, undefined)

    const second = await fetchJsonConditional<{ status: { indicator: string } }>(url, OPTIONS)
    assert.deepEqual(second, first)
    assert.equal(seen[1]?.ifNoneMatch, ETAG)
    assert.equal(seen[1]?.ifModifiedSince, LAST_MODIFIED)

    const stats = drainConditionalFetchStats()
    assert.equal(stats.requests, 2)
    assert.equal(stats.notModified, 1)
  } finally {
    server.close()
  }
})

test("fetchStatuspageState maps identically from a 304 tick", async () => {
  clearValidatorCache()
  drainConditionalFetchStats()
  const seen: SeenRequest[] = []
  const server = statuspageStyleServer(seen)
  const origin = await listen(server)
  try {
    const fullTick = await fetchStatuspageState(origin, OPTIONS)
    const conditionalTick = await fetchStatuspageState(origin, OPTIONS)
    assert.deepEqual(conditionalTick, fullTick)
    assert.equal(conditionalTick.status, "operational")
    assert.equal(conditionalTick.components.length, 1)

    // 2 URLs (summary + incidents) x 2 ticks; second tick is all 304s.
    const stats = drainConditionalFetchStats()
    assert.equal(stats.requests, 4)
    assert.equal(stats.notModified, 2)
    assert.equal(seen.filter((request) => request.ifNoneMatch === ETAG).length, 2)
  } finally {
    server.close()
  }
})

test("responses without validators fall back to a full GET every time", async () => {
  clearValidatorCache()
  drainConditionalFetchStats()
  const seen: SeenRequest[] = []
  const server = createServer((req, res) => {
    seen.push({
      url: req.url ?? "",
      ifNoneMatch: req.headers["if-none-match"] as string | undefined,
      ifModifiedSince: req.headers["if-modified-since"] as string | undefined,
    })
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
  })
  const origin = await listen(server)
  try {
    const url = `${origin}/summary.json`
    await fetchBodyConditional(url, OPTIONS)
    await fetchBodyConditional(url, OPTIONS)
    assert.equal(seen[1]?.ifNoneMatch, undefined)
    assert.equal(seen[1]?.ifModifiedSince, undefined)
    const stats = drainConditionalFetchStats()
    assert.equal(stats.requests, 2)
    assert.equal(stats.notModified, 0)
  } finally {
    server.close()
  }
})

test("non-2xx still throws", async () => {
  clearValidatorCache()
  const server = createServer((_req, res) => {
    res.writeHead(503)
    res.end()
  })
  const origin = await listen(server)
  try {
    await assert.rejects(
      fetchBodyConditional(`${origin}/summary.json`, OPTIONS),
      /HTTP 503/,
    )
  } finally {
    server.close()
  }
})
