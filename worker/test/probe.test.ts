import assert from "node:assert/strict"
import test from "node:test"
import { probeAll, probeLatency, type ProbeTarget } from "../src/probe.js"

const TARGET: ProbeTarget = {
  providerId: "openai",
  url: "https://api.example.com/v1/models",
  method: "HEAD",
}

function fakeClock(...ticks: number[]): () => number {
  let i = 0
  return () => ticks[Math.min(i++, ticks.length - 1)]
}

test("probeLatency measures round-trip time on any HTTP response", async () => {
  const fetchImpl = (async () => new Response(null, { status: 200 })) as typeof fetch
  const result = await probeLatency(TARGET, {
    timeoutMs: 5000,
    userAgent: "test",
    fetchImpl,
    now: fakeClock(1000, 1234),
  })
  assert.deepEqual(result, { providerId: "openai", latencyMs: 234 })
})

test("probeLatency counts an unauthenticated 401 as a valid measurement", async () => {
  const fetchImpl = (async () => new Response(null, { status: 401 })) as typeof fetch
  const result = await probeLatency(TARGET, {
    timeoutMs: 5000,
    userAgent: "test",
    fetchImpl,
    now: fakeClock(0, 87),
  })
  assert.deepEqual(result, { providerId: "openai", latencyMs: 87 })
})

test("probeLatency returns null on network failure instead of throwing", async () => {
  const fetchImpl = (async () => {
    throw new Error("getaddrinfo ENOTFOUND")
  }) as typeof fetch
  const result = await probeLatency(TARGET, {
    timeoutMs: 5000,
    userAgent: "test",
    fetchImpl,
  })
  assert.deepEqual(result, { providerId: "openai", latencyMs: null })
})

test("probeAll maps provider ids to latencies, keeping failures as null", async () => {
  const targets: ProbeTarget[] = [
    TARGET,
    { providerId: "broken", url: "https://down.example.com/", method: "GET" },
  ]
  const fetchImpl = (async (input: RequestInfo | URL) => {
    if (String(input).includes("down.example.com")) {
      throw new Error("connect ECONNREFUSED")
    }
    return new Response(null, { status: 200 })
  }) as typeof fetch

  const latencies = await probeAll(targets, {
    timeoutMs: 5000,
    userAgent: "test",
    fetchImpl,
  })
  assert.equal(typeof latencies.get("openai"), "number")
  assert.equal(latencies.get("broken"), null)
})
