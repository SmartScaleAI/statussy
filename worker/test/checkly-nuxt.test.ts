import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  CHECKLY_BROWSER_UA,
  extractNuxtData,
  fetchChecklyNuxtState,
  hydrateNuxtPayload,
  mapChecklyNuxt,
  mapChecklySeverity,
  parseChecklyNuxtHtml,
  type ChecklyPage,
} from "../src/checkly-nuxt.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

async function loadNuxtHtml(): Promise<string> {
  const payload = await readFile(join(FIXTURES, "checkly-nuxt-data.json"), "utf8")
  return `<!DOCTYPE html><html lang="en"><head><title>Status | Mistral AI Status Page</title></head><body>
<script type="application/json" data-nuxt-data="nuxt-app" id="__NUXT_DATA__">${payload.trim()}</script>
</body></html>`
}

function operationalPage(overrides: Partial<ChecklyPage> = {}): ChecklyPage {
  return {
    statusPage: { id: "page-1", name: "Mistral AI Status Page", customDomain: "status.mistral.ai" },
    incidents: [],
    components: [
      { id: "svc-a", name: "Chat Completions API", uptime: 99.9, groupName: "API" },
      { id: "svc-b", name: "Embeddings API", uptime: 100, groupName: "API" },
    ],
    activeMaintenance: [],
    ...overrides,
  }
}

test("mapChecklySeverity covers Checkly incident severities", () => {
  assert.equal(mapChecklySeverity("MINOR"), "degraded")
  assert.equal(mapChecklySeverity("MEDIUM"), "degraded")
  assert.equal(mapChecklySeverity("MAJOR"), "partial_outage")
  assert.equal(mapChecklySeverity("CRITICAL"), "major_outage")
  assert.equal(mapChecklySeverity("major"), "partial_outage")
  assert.equal(mapChecklySeverity("SOMETHING_NEW"), "unknown")
  assert.equal(mapChecklySeverity(undefined), "unknown")
  assert.equal(mapChecklySeverity(null), "unknown")
})

test("extractNuxtData + hydrateNuxtPayload revive the saved Mistral payload", async () => {
  const html = await loadNuxtHtml()
  const payload = extractNuxtData(html)
  assert.ok(Array.isArray(payload))
  assert.deepEqual(payload[0], ["ShallowReactive", 1])

  const hydrated = hydrateNuxtPayload(payload) as { data: Record<string, unknown> }
  assert.ok(hydrated.data)
  const keys = Object.keys(hydrated.data)
  assert.ok(keys.some((k) => k.startsWith("unresolved-incidents-")))
  assert.ok(keys.some((k) => k.startsWith("uptime-")))
  assert.ok(keys.some((k) => k.startsWith("status-page-resolver-")))
})

test("parseChecklyNuxtHtml reads the saved Mistral __NUXT_DATA__ fixture", async () => {
  const page = parseChecklyNuxtHtml(await loadNuxtHtml())

  assert.equal(page.statusPage?.customDomain, "status.mistral.ai")
  assert.equal(page.statusPage?.name, "Mistral AI Status Page")
  assert.equal(page.incidents.length, 1)
  assert.equal(page.incidents[0].name, "Free Tier Temporarily Disabled")
  assert.equal(page.incidents[0].severity, "MAJOR")
  assert.equal(page.incidents[0].lastUpdateStatus, "IDENTIFIED")
  assert.equal(page.incidents[0].services?.[0]?.name, "Chat Completions API")

  assert.equal(page.components.length, 5)
  assert.equal(page.components[0].name, "Chat Completions API")
  assert.equal(page.components[0].groupName, "API")
  assert.equal(page.components[0].uptime, 98.731)
  assert.equal(page.components[3].name, "Le Console (developer tools)")
  assert.equal(page.components[3].groupName, "Services")
  assert.equal(page.activeMaintenance.length, 0)
})

test("mapChecklyNuxt maps the Mistral fixture to a partial outage", async () => {
  const page = parseChecklyNuxtHtml(await loadNuxtHtml())
  const state = mapChecklyNuxt(page, "https://status.mistral.ai/")

  assert.equal(state.status, "partial_outage")
  assert.equal(state.detail.source, "checkly_nuxt")
  assert.equal(state.detail.pageId, "89510173-714f-4ba6-9ad3-b4598370f903")
  assert.equal(state.detail.customDomain, "status.mistral.ai")
  assert.equal(state.detail.unresolvedCount, 1)
  assert.equal(state.incidentTitle, "Free Tier Temporarily Disabled")

  assert.equal(state.components.length, 5)
  const byName = new Map(state.components.map((c) => [c.name, c]))
  assert.equal(byName.get("Chat Completions API")?.status, "partial_outage")
  assert.equal(byName.get("Embeddings API")?.status, "operational")
  assert.equal(byName.get("OCR API")?.status, "operational")
  assert.equal(byName.get("Le Console (developer tools)")?.status, "operational")
  assert.equal(byName.get("Chat Completions API")?.externalId, "c4869a5a-054c-4c1b-88d1-3d195ba58511")
  assert.equal(byName.get("Chat Completions API")?.position, 0)
  assert.equal(byName.get("Le Console (developer tools)")?.position, 3)

  assert.equal(state.incidents.length, 1)
  const incident = state.incidents[0]
  assert.equal(incident.title, "Free Tier Temporarily Disabled")
  assert.equal(incident.status, "identified")
  assert.equal(incident.impact, "major")
  assert.equal(incident.resolvedAt, null)
  assert.equal(incident.startedAt, "2026-09-04T04:04:04.000Z")
  assert.equal(incident.url, "https://status.mistral.ai/incident/44cb5e11-4736-4e6b-9198-97121820e15e")

  const uptime = state.detail.componentUptime as Record<string, number>
  assert.equal(uptime["c4869a5a-054c-4c1b-88d1-3d195ba58511"], 98.731)
})

test("mapChecklyNuxt handles an all-operational page with no incidents", () => {
  const state = mapChecklyNuxt(operationalPage(), "https://status.mistral.ai")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.components.length, 2)
  assert.ok(state.components.every((c) => c.status === "operational"))
})

test("mapChecklyNuxt treats active maintenance as maintenance when nothing is worse", () => {
  const state = mapChecklyNuxt(
    operationalPage({
      activeMaintenance: [
        { id: "mw-1", name: "Scheduled API work", start: "2026-09-04T22:00:00.000Z" },
      ],
    }),
    "https://status.mistral.ai",
  )
  assert.equal(state.status, "maintenance")
  assert.equal(state.incidentTitle, "Scheduled API work")
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].status, "maintenance")
  assert.equal(state.incidents[0].impact, "maintenance")
  assert.equal(state.incidents[0].startedAt, "2026-09-04T22:00:00.000Z")
})

test("mapChecklyNuxt keeps a MAJOR incident worse than active maintenance", () => {
  const state = mapChecklyNuxt(
    operationalPage({
      incidents: [
        {
          id: "inc-1",
          name: "API down",
          severity: "MAJOR",
          lastUpdateStatus: "INVESTIGATING",
          created_at: "2026-09-04T12:00:00.000Z",
          services: [{ id: "svc-a", name: "Chat Completions API" }],
        },
      ],
      activeMaintenance: [{ id: "mw-1", name: "Window" }],
    }),
    "https://status.mistral.ai",
  )
  assert.equal(state.status, "partial_outage")
  assert.equal(state.incidentTitle, "API down")
})

test("mapChecklyNuxt overlays the worst incident severity onto affected components", () => {
  const state = mapChecklyNuxt(
    operationalPage({
      incidents: [
        {
          id: "inc-minor",
          name: "Slow embeddings",
          severity: "MEDIUM",
          lastUpdateStatus: "MONITORING",
          services: [{ id: "svc-b" }],
        },
        {
          id: "inc-crit",
          name: "Chat outage",
          severity: "CRITICAL",
          lastUpdateStatus: "IDENTIFIED",
          services: [{ id: "svc-a" }],
        },
      ],
    }),
    "https://status.mistral.ai",
  )
  assert.equal(state.status, "major_outage")
  const byName = new Map(state.components.map((c) => [c.name, c]))
  assert.equal(byName.get("Chat Completions API")?.status, "major_outage")
  assert.equal(byName.get("Embeddings API")?.status, "degraded")
})

test("extractNuxtData throws on Cloudflare challenge HTML", () => {
  const html =
    "<!DOCTYPE html><html><head><title>Just a moment...</title></head>" +
    "<body>cloudflare cf-browser-verification</body></html>"
  assert.throws(() => extractNuxtData(html), /Cloudflare challenge/)
})

test("extractNuxtData throws when __NUXT_DATA__ is missing", () => {
  assert.throws(() => extractNuxtData("<html><body>nope</body></html>"), /No __NUXT_DATA__/)
})

test("parseChecklyNuxtHtml throws when the payload has no components", () => {
  const empty = [
    ["ShallowReactive", 1],
    {
      data: 2,
    },
    {
      "unresolved-incidents-x": 3,
    },
    { incidents: 4 },
    [],
  ]
  const html = `<script id="__NUXT_DATA__">${JSON.stringify(empty)}</script>`
  assert.throws(() => parseChecklyNuxtHtml(html), /no components/)
})

test("fetchChecklyNuxtState sends a browser-like UA and maps the HTML", async () => {
  const html = await loadNuxtHtml()
  const seen: string[] = []
  const fetchImpl: typeof fetch = async (_url, init) => {
    const headers = new Headers(init?.headers)
    seen.push(headers.get("user-agent") ?? "")
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } })
  }

  const state = await fetchChecklyNuxtState("https://status.mistral.ai", {
    timeoutMs: 5000,
    userAgent: "statussy-worker/0.1 (+https://github.com/SmartScaleAI/statussy)",
    fetchImpl,
  })

  assert.equal(seen[0], CHECKLY_BROWSER_UA)
  assert.equal(state.status, "partial_outage")
  assert.equal(state.detail.source, "checkly_nuxt")
  assert.equal(state.components.length, 5)
})
