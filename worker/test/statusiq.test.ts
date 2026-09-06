import assert from "node:assert/strict"
import test from "node:test"
import { parseFeed } from "../src/rss.js"
import {
  mapStatusiqComponentStatus,
  mapStatusiqFeed,
  parseStatusiqItem,
} from "../src/statusiq.js"

const MATOMO_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Matomo Cloud - Status</title>
<item><title>Cloud Archiving - Operational</title><description>Cloud Archiving is Operational</description><guid>g1</guid></item>
<item><title>Cloud Dashboard - Degraded Performance</title><description>Cloud Dashboard is Degraded Performance</description><guid>g2</guid></item>
<item><title>Cloud Tracking - Operational</title><description>Cloud Tracking is Operational</description><guid>g3</guid></item>
</channel></rss>`

test("mapStatusiqComponentStatus covers StatusIQ labels", () => {
  assert.equal(mapStatusiqComponentStatus("Operational"), "operational")
  assert.equal(mapStatusiqComponentStatus("Degraded Performance"), "degraded")
  assert.equal(mapStatusiqComponentStatus("Partial Outage"), "partial_outage")
  assert.equal(mapStatusiqComponentStatus("Major Outage"), "major_outage")
  assert.equal(mapStatusiqComponentStatus("Under Maintenance"), "maintenance")
  assert.equal(mapStatusiqComponentStatus("Informational"), "operational")
})

test("parseStatusiqItem reads Name - Status titles", () => {
  const parsed = parseStatusiqItem({
    externalId: "x",
    title: "API - Operational",
    link: null,
    publishedAt: null,
    text: "API is Operational",
    categories: [],
  })
  assert.deepEqual(parsed, { name: "API", status: "operational" })
})

test("mapStatusiqFeed builds named components and worst-status rollup", () => {
  const state = mapStatusiqFeed(parseFeed(MATOMO_RSS), {
    feedUrl: "https://status.matomo.cloud/rss",
    pageUrl: "https://status.matomo.cloud",
  })
  assert.equal(state.detail.source, "statusiq")
  assert.equal(state.status, "degraded")
  assert.equal(state.components.length, 3)
  const byName = new Map(state.components.map((c) => [c.name, c]))
  assert.equal(byName.get("Cloud Archiving")?.status, "operational")
  assert.equal(byName.get("Cloud Dashboard")?.status, "degraded")
  assert.equal(byName.get("Cloud Tracking")?.externalId, "Cloud Tracking")
  assert.equal(state.incidents.length, 0)
})

test("mapStatusiqFeed throws when the feed has no components", () => {
  assert.throws(() =>
    mapStatusiqFeed([], { feedUrl: "https://example.test/rss", pageUrl: "https://example.test" }),
  )
})
