import assert from "node:assert/strict"
import test from "node:test"
import {
  fetchOutreachState,
  mapOutreach,
  outreachHasOutage,
  parseOutreachOutageTitle,
  type OutreachProbe,
} from "../src/outreach.js"

const SPA_SHELL = `<!doctype html><html><head><title>Status | Outreach</title></head><body><div id="app"></div>
<script>let OUTAGE_URL="/outage.html";</script></body></html>`

const OUTAGE_HTML = `<!doctype html><html><head><title>Outreach is down</title></head>
<body><h1>API and sequencer outage</h1><p>We are investigating.</p></body></html>`

test("parseOutreachOutageTitle prefers a real h1 over the SPA title", () => {
  assert.equal(parseOutreachOutageTitle(OUTAGE_HTML), "API and sequencer outage")
  assert.equal(parseOutreachOutageTitle(SPA_SHELL), "Outreach outage")
})

test("outreachHasOutage uses distinct etags or a real outage document", () => {
  const quiet: OutreachProbe = {
    indexEtag: '"abc"',
    outageEtag: '"abc"',
    outageOk: true,
    outageHtml: SPA_SHELL,
  }
  assert.equal(outreachHasOutage(quiet), false)

  const flipped: OutreachProbe = {
    indexEtag: '"abc"',
    outageEtag: '"def"',
    outageOk: true,
    outageHtml: SPA_SHELL,
  }
  assert.equal(outreachHasOutage(flipped), true)

  const htmlOnly: OutreachProbe = {
    indexEtag: '"abc"',
    outageEtag: '"abc"',
    outageOk: true,
    outageHtml: OUTAGE_HTML,
  }
  assert.equal(outreachHasOutage(htmlOnly), true)
})

test("mapOutreach is operational when index and outage etags match", () => {
  const state = mapOutreach({
    indexEtag: '"2846bb674fca536784d925d18d699350"',
    outageEtag: '"2846bb674fca536784d925d18d699350"',
    outageOk: true,
    outageHtml: SPA_SHELL,
  })
  assert.equal(state.detail.source, "outreach")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
  assert.equal(state.components[0].name, "Outreach")
})

test("mapOutreach paints a major outage when the etag flips", () => {
  const state = mapOutreach({
    indexEtag: '"index"',
    outageEtag: '"outage"',
    outageOk: true,
    outageHtml: OUTAGE_HTML,
  })
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "API and sequencer outage")
  assert.equal(state.incidents[0].url, "https://status.outreach.io/outage.html")
  assert.equal(state.components[0].status, "major_outage")
})

test("fetchOutreachState follows the SPA HEAD etag flip", async () => {
  const headersFor = (etag: string) => new Headers({ etag })
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    const method = (init?.method ?? "GET").toUpperCase()
    if (url.endsWith("/index.html")) {
      return new Response(method === "HEAD" ? null : SPA_SHELL, {
        status: 200,
        headers: headersFor('"index"'),
      })
    }
    if (url.endsWith("/outage.html")) {
      return new Response(method === "HEAD" ? null : OUTAGE_HTML, {
        status: 200,
        headers: headersFor('"outage"'),
      })
    }
    return new Response("nope", { status: 404 })
  }

  const state = await fetchOutreachState({
    timeoutMs: 1000,
    userAgent: "statussy-test",
    fetchImpl,
  })
  assert.equal(state.status, "major_outage")
  assert.equal(state.incidentTitle, "API and sequencer outage")
})
