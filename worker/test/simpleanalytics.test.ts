import assert from "node:assert/strict"
import test from "node:test"
import { mapSimpleAnalyticsDiary, parseJekyllIncidents } from "../src/simpleanalytics.js"

const DIARY = `
<h3><a href="/incidents/21">Ingest stalled</a></h3>
<p>
    <span class="label investigating">investigating</span>
    <span class="text-muted"><time datetime="2026-09-06T11:00:00+00:00">2026-09-06 11:00:00 UTC</time></span>
    We are looking into it.
    <a href="/incidents/21">Read more</a>.
  </p>
<h3><a href="/incidents/20">Dashboard temporarily down</a></h3>
<p>
    <span class="label resolved">resolved</span>
    <span class="text-muted"><time datetime="2026-03-13T11:59:00+00:00">2026-03-13 11:59:00 UTC</time></span>
    The dashboard is temporarily down since 11:59 UTC.
    <a href="/incidents/20">Read more</a>.
  </p>
`

test("parseJekyllIncidents reads diary entries", () => {
  const items = parseJekyllIncidents(DIARY)
  assert.equal(items.length, 2)
  assert.equal(items[0].id, "21")
  assert.equal(items[0].title, "Ingest stalled")
  assert.equal(items[0].label, "investigating")
  assert.equal(items[1].label, "resolved")
})

test("mapSimpleAnalyticsDiary is operational when every diary row is resolved", () => {
  const resolvedOnly = parseJekyllIncidents(DIARY.replace("investigating", "resolved"))
  const state = mapSimpleAnalyticsDiary(resolvedOnly, [], "https://status.simpleanalytics.com")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 2)
  assert.equal(state.detail.source, "simpleanalytics")
})

test("mapSimpleAnalyticsDiary paints an open diary row", () => {
  const state = mapSimpleAnalyticsDiary(
    parseJekyllIncidents(DIARY),
    [],
    "https://status.simpleanalytics.com",
  )
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "Ingest stalled")
  assert.equal(state.incidents[0].url, "https://status.simpleanalytics.com/incidents/21")
  assert.equal(state.incidents[0].resolvedAt, null)
  assert.equal(state.incidents[1].status, "resolved")
})

test("mapSimpleAnalyticsDiary falls back to RSS when HTML is empty", () => {
  const state = mapSimpleAnalyticsDiary(
    [],
    [
      {
        externalId: "rss-1",
        title: "CDN blip",
        link: "https://status.simpleanalytics.com/incidents/9",
        publishedAt: "Fri, 13 Mar 2026 12:15:39 GMT",
        text: "Status: RESOLVED",
        categories: ["resolved"],
      },
    ],
    "https://status.simpleanalytics.com",
  )
  assert.equal(state.status, "operational")
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].status, "resolved")
})
