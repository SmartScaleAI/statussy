import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  classifyOpenIncident,
  decodeXmlEntities,
  extractIncidentStatus,
  mapRssFeed,
  parseFeed,
  stripHtml,
  type RssItem,
} from "../src/rss.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

function makeItem(overrides: Partial<RssItem>): RssItem {
  return {
    externalId: "id-1",
    title: "Something happened",
    link: null,
    publishedAt: null,
    text: "",
    categories: [],
    ...overrides,
  }
}

test("decodeXmlEntities handles named, decimal and hex entities", () => {
  assert.equal(decodeXmlEntities("&lt;p&gt; &amp; &quot;x&quot; &#65; &#x41;"), '<p> & "x" A A')
  assert.equal(decodeXmlEntities("plain text"), "plain text")
})

test("stripHtml flattens tags and keeps line structure", () => {
  const text = stripHtml("<h3>Status: RESOLVED</h3><p>Severity: available</p><p>Resolved: Thu, 03 Sep 2026 17:08:11 GMT</p>")
  assert.match(text, /Status: RESOLVED/)
  assert.match(text, /^Severity: available$/m)
  assert.match(text, /^Resolved: Thu, 03 Sep 2026 17:08:11 GMT$/m)
})

test("parseFeed rejects non-feed payloads", () => {
  assert.throws(() => parseFeed("<!doctype html><html><body>nope</body></html>"))
  assert.throws(() => parseFeed('{"status":{"indicator":"none"}}'))
})

test("parseFeed reads the xAI RSS fixture", async () => {
  const xml = await readFile(join(FIXTURES, "xai-feed.xml"), "utf8")
  const items = parseFeed(xml)

  assert.equal(items.length, 3)
  const [open, resolved] = items
  assert.equal(open.externalId, "INCaaaa111")
  assert.equal(open.title, "[API] Elevated error rates")
  assert.equal(open.link, "https://status.x.ai/api/INCaaaa111")
  assert.equal(open.publishedAt, "Thu, 03 Sep 2026 18:00:00 GMT")
  assert.deepEqual(open.categories, ["degraded", "ongoing"])
  assert.match(open.text, /Status: ONGOING/)

  assert.equal(resolved.externalId, "INCc33a8af")
  assert.deepEqual(resolved.categories, ["available", "resolved"])
  assert.match(resolved.text, /^Resolved: Thu, 03 Sep 2026 17:08:11 GMT$/m)
})

test("parseFeed reads the DeepSeek RSS fixture (escaped HTML descriptions)", async () => {
  const xml = await readFile(join(FIXTURES, "deepseek-feed.rss"), "utf8")
  const items = parseFeed(xml)

  assert.equal(items.length, 3)
  assert.equal(items[0].externalId, "urn:flashduty:change:6927183076287")
  assert.equal(items[0].link, "https://status.deepseek.com/incidents/6927183076287")
  assert.match(items[0].text, /Status: resolved/)
  assert.match(items[0].text, /Affected components:/)
})

test("parseFeed reads the DeepSeek Atom fixture", async () => {
  const xml = await readFile(join(FIXTURES, "deepseek-feed.atom"), "utf8")
  const items = parseFeed(xml)

  assert.equal(items.length, 2)
  assert.equal(items[0].externalId, "urn:flashduty:change:6927183076287")
  assert.equal(items[0].link, "https://status.deepseek.com/incidents/6927183076287")
  assert.equal(items[0].publishedAt, "2026-09-02T14:25:45+08:00")
  assert.match(items[0].text, /Status: resolved/)
})

test("extractIncidentStatus recognizes resolved, ongoing and vendor states", () => {
  assert.equal(
    extractIncidentStatus(makeItem({ text: "Status: RESOLVED\nSeverity: available" })),
    "resolved",
  )
  assert.equal(
    extractIncidentStatus(makeItem({ text: "Status: ONGOING\nSeverity: degraded" })),
    "investigating",
  )
  assert.equal(extractIncidentStatus(makeItem({ text: "Status: investigating" })), "investigating")
  assert.equal(extractIncidentStatus(makeItem({ text: "Status: monitoring" })), "monitoring")
  // No status line, but a resolved category (xAI tags lifecycle as category).
  assert.equal(extractIncidentStatus(makeItem({ categories: ["resolved"] })), "resolved")
  // Nothing recognizable -> treated as an open incident.
  assert.equal(extractIncidentStatus(makeItem({ text: "something broke" })), "investigating")
})

test("classifyOpenIncident maps keywords to severities (incl. bilingual)", () => {
  assert.equal(classifyOpenIncident(makeItem({ title: "Major outage" })), "major_outage")
  assert.equal(classifyOpenIncident(makeItem({ title: "[Grok (Web)] Models outage" })), "partial_outage")
  assert.equal(classifyOpenIncident(makeItem({ title: "DeepSeek 网页/API 部分中断" })), "partial_outage")
  assert.equal(classifyOpenIncident(makeItem({ title: "API Degraded Performance" })), "degraded")
  assert.equal(classifyOpenIncident(makeItem({ title: "DeepSeek API 性能下降" })), "degraded")
  assert.equal(classifyOpenIncident(makeItem({ title: "Scheduled maintenance" })), "maintenance")
  assert.equal(classifyOpenIncident(makeItem({ title: "weird unlabeled thing" })), "degraded")
})

test("mapRssFeed on the xAI fixture: open incident drives status + headline", async () => {
  const xml = await readFile(join(FIXTURES, "xai-feed.xml"), "utf8")
  const state = mapRssFeed(parseFeed(xml), {
    feedUrl: "https://status.x.ai/feed.xml",
    feedTitle: "SpaceXAI System Status",
    lastBuildDate: "Thu, 03 Sep 2026 17:10:57 GMT",
  })

  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "[API] Elevated error rates")
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 3)

  const [open, resolved] = state.incidents
  assert.equal(open.externalId, "INCaaaa111")
  assert.equal(open.status, "investigating")
  assert.equal(open.impact, "degraded")
  assert.equal(open.startedAt, "2026-09-03T18:00:00.000Z")
  assert.equal(open.resolvedAt, null)
  assert.equal(open.url, "https://status.x.ai/api/INCaaaa111")

  assert.equal(resolved.status, "resolved")
  assert.equal(resolved.impact, "available")
  assert.equal(resolved.startedAt, "2026-09-03T13:30:00.000Z")
  assert.equal(resolved.resolvedAt, "2026-09-03T17:08:11.000Z")

  assert.deepEqual(state.detail, {
    source: "rss",
    feedUrl: "https://status.x.ai/feed.xml",
    feedTitle: "SpaceXAI System Status",
    lastBuildDate: "Thu, 03 Sep 2026 17:10:57 GMT",
    openIncidents: 1,
  })
})

test("mapRssFeed on the DeepSeek fixture: open item wins over resolved ones", async () => {
  const xml = await readFile(join(FIXTURES, "deepseek-feed.rss"), "utf8")
  const state = mapRssFeed(parseFeed(xml), {
    feedUrl: "https://status.deepseek.com/feed.rss",
    feedTitle: "DeepSeek",
    lastBuildDate: null,
  })

  // Fixture has one investigating item (degraded performance) among resolved ones.
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "DeepSeek API 性能下降（DeepSeek API Degraded Performance）")
  assert.equal(state.incidents.length, 3)

  const resolved = state.incidents[0]
  assert.equal(resolved.status, "resolved")
  // DeepSeek's feed carries no resolution timestamp; status alone closes it.
  assert.equal(resolved.resolvedAt, null)
  assert.equal(resolved.impact, null)
  assert.equal(resolved.startedAt, "2026-09-02T05:54:24.000Z")

  const open = state.incidents[1]
  assert.equal(open.status, "investigating")
  assert.equal(open.resolvedAt, null)
})

test("mapRssFeed with all incidents resolved reports operational", async () => {
  const xml = await readFile(join(FIXTURES, "deepseek-feed.atom"), "utf8")
  const state = mapRssFeed(parseFeed(xml), {
    feedUrl: "https://status.deepseek.com/feed.atom",
    feedTitle: "DeepSeek",
    lastBuildDate: "2026-09-02T14:25:45+08:00",
  })

  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 2)
  assert.ok(state.incidents.every((i) => i.status === "resolved"))
})

test("mapRssFeed respects maxIncidents and skips id-less items", () => {
  const items: RssItem[] = [
    makeItem({ externalId: "a", title: "one", text: "Status: resolved" }),
    makeItem({ externalId: null, title: "no id", text: "Status: resolved" }),
    makeItem({ externalId: "b", title: "two", text: "Status: resolved" }),
    makeItem({ externalId: "c", title: "three", text: "Status: resolved" }),
  ]
  const state = mapRssFeed(items, { feedUrl: "x", feedTitle: null, lastBuildDate: null }, 3)
  assert.deepEqual(
    state.incidents.map((i) => i.externalId),
    ["a", "b"],
  )
})

test("mapRssFeed of an empty feed is operational with no incidents", () => {
  const state = mapRssFeed([], { feedUrl: "x", feedTitle: null, lastBuildDate: null })
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.incidents.length, 0)
})
