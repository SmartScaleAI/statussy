import assert from "node:assert/strict"
import test from "node:test"
import { parseFeed } from "../src/rss.js"
import {
  extractStatusiqPageId,
  mapStatusiqComponentStatus,
  mapStatusiqFeed,
  mapStatusiqNumericStatus,
  mapStatusiqSummary,
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

test("mapStatusiqNumericStatus covers StatusIQ public API codes", () => {
  assert.equal(mapStatusiqNumericStatus(1), "operational")
  assert.equal(mapStatusiqNumericStatus(2), "degraded")
  assert.equal(mapStatusiqNumericStatus(3), "partial_outage")
  assert.equal(mapStatusiqNumericStatus(4), "major_outage")
  assert.equal(mapStatusiqNumericStatus(5), "maintenance")
  assert.equal(mapStatusiqNumericStatus(6), "operational")
})

test("extractStatusiqPageId reads enc_statuspage_id from the SPA bootstrap", () => {
  const html = `statuspages.globals.statuspageDetails = {"enc_statuspage_id":"P4CJ5YG_lN8Fh07rnB3KSStEkzXCM5Q43Q7erkQCqDQ=","status":1}`
  assert.equal(
    extractStatusiqPageId(html),
    "P4CJ5YG_lN8Fh07rnB3KSStEkzXCM5Q43Q7erkQCqDQ=",
  )
})

test("mapStatusiqSummary maps VWO current_status + an active incident", () => {
  const state = mapStatusiqSummary(
    {
      current_status: [
        {
          enc_component_id: "app",
          display_name: "VWO Application",
          is_group: false,
          component_status: 1,
        },
        {
          enc_component_id: "cdn",
          display_name: "VWO DaCDN",
          is_group: false,
          component_status: 3,
        },
      ],
      active_incident_details: [
        {
          enc_incident_id: "inc-1",
          title: "DaCDN delays",
          status: "investigating",
          started_at: "2026-09-06T10:00:00+0000",
        },
      ],
      statuspage_details: { status: 3 },
    },
    { pageUrl: "https://status.vwo.com", pageId: "abc" },
  )
  assert.equal(state.detail.source, "statusiq_api")
  assert.equal(state.status, "partial_outage")
  assert.equal(state.components.length, 2)
  assert.equal(state.incidentTitle, "DaCDN delays")
  const byName = new Map(state.components.map((component) => [component.name, component]))
  assert.equal(byName.get("VWO DaCDN")?.status, "partial_outage")
})
