import assert from "node:assert/strict"
import test from "node:test"
import {
  fetchGoogleCloudGeminiState,
  fetchGoogleCloudPlatformState,
} from "../src/google-cloud.js"
import { fetchStatuspageNameFilterState, type FetchOptions } from "../src/statuspage.js"
import { createTickDedupe } from "../src/tick-dedupe.js"

const OPTIONS: FetchOptions = { timeoutMs: 5_000, userAgent: "statussy-test" }

/** Stub global fetch with canned JSON bodies; returns per-URL hit counts. */
function stubFetch(bodies: Record<string, unknown>): {
  counts: Map<string, number>
  restore: () => void
} {
  const counts = new Map<string, number>()
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    counts.set(url, (counts.get(url) ?? 0) + 1)
    const body = bodies[url]
    if (body === undefined) {
      return new Response("not found", { status: 404 })
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch
  return { counts, restore: () => { globalThis.fetch = original } }
}

test("SMA-96: one tick fetches the shared HashiCorp Statuspage once for all five products", async () => {
  const { counts, restore } = stubFetch({
    "https://status.hashicorp.com/api/v2/summary.json": {
      status: { indicator: "minor", description: "Partial outage" },
      components: [
        { id: "tf", name: "Terraform Cloud", status: "degraded_performance" },
        { id: "va", name: "Vault Dedicated", status: "operational" },
        { id: "co", name: "Consul Dedicated", status: "operational" },
        { id: "no", name: "Nomad", status: "operational" },
        { id: "pa", name: "Packer", status: "operational" },
      ],
    },
    "https://status.hashicorp.com/api/v2/incidents.json": { incidents: [] },
  })
  try {
    const shared = createTickDedupe()
    const products = ["Terraform", "Vault", "Consul", "Nomad", "Packer"]
    const states = await Promise.all(
      products.map((nameIncludes) =>
        fetchStatuspageNameFilterState(
          "https://status.hashicorp.com",
          OPTIONS,
          { nameIncludes },
          shared,
        ),
      ),
    )

    assert.equal(counts.get("https://status.hashicorp.com/api/v2/summary.json"), 1)
    assert.equal(counts.get("https://status.hashicorp.com/api/v2/incidents.json"), 1)

    // Per-product slices are unchanged: each card still sees only its own rows.
    assert.deepEqual(
      states.map((state) => state.components.map((component) => component.name)),
      [
        ["Terraform Cloud"],
        ["Vault Dedicated"],
        ["Consul Dedicated"],
        ["Nomad"],
        ["Packer"],
      ],
    )
    assert.equal(states[0].status, "degraded")
    assert.equal(states[1].status, "operational")
  } finally {
    restore()
  }
})

test("SMA-96: one tick fetches the shared Google Cloud payloads once for GCP + Gemini", async () => {
  const { counts, restore } = stubFetch({
    "https://status.cloud.google.com/incidents.json": [
      {
        id: "open-gemini",
        external_desc: "Gemini errors",
        status_impact: "SERVICE_DISRUPTION",
        begin: "2026-09-07T00:00:00Z",
        affected_products: [{ id: "Z0FZJAMvEB4j3NbCJs6B", title: "Gemini on Agent Platform" }],
      },
    ],
    "https://status.cloud.google.com/products.json": {
      products: [{ id: "Z0FZJAMvEB4j3NbCJs6B", title: "Gemini on Agent Platform" }],
    },
  })
  try {
    const shared = createTickDedupe()
    const [gemini, platform] = await Promise.all([
      fetchGoogleCloudGeminiState(OPTIONS, shared),
      fetchGoogleCloudPlatformState(OPTIONS, shared),
    ])

    assert.equal(counts.get("https://status.cloud.google.com/incidents.json"), 1)
    assert.equal(counts.get("https://status.cloud.google.com/products.json"), 1)

    // Both cards still map their own view of the shared bytes.
    assert.equal(gemini.status, "partial_outage")
    assert.equal(gemini.components.length, 1)
    assert.equal(platform.status, "partial_outage")
    assert.equal(platform.components.length, 0)
  } finally {
    restore()
  }
})

test("SMA-96: a fresh dedupe (next tick) fetches again — no cross-tick staleness", async () => {
  const { counts, restore } = stubFetch({
    "https://status.cloud.google.com/incidents.json": [],
    "https://status.cloud.google.com/products.json": { products: [] },
  })
  try {
    await fetchGoogleCloudGeminiState(OPTIONS, createTickDedupe())
    await fetchGoogleCloudGeminiState(OPTIONS, createTickDedupe())
    assert.equal(counts.get("https://status.cloud.google.com/incidents.json"), 2)
  } finally {
    restore()
  }
})
