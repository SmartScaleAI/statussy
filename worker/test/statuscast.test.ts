import assert from "node:assert/strict"
import test from "node:test"
import {
  extractStatusCastStatus,
  mapStatusCastFeed,
  mapStatuscastHtml,
  mapStatuscastLabel,
  parseStatuscastHero,
  parseStatuscastIncidents,
  statusCastIncidentId,
  statuscastPaintsCard,
} from "../src/statuscast.js"
import { parseFeed, type RssItem } from "../src/rss.js"

const FASTLY_HTML = `
<body class="sc-state-normal">
  <div class="sc-hero">
    <div class="sc-hero__status-label">
      <span class="sc-status-dot"></span>
      <span>All Systems Operational</span>
    </div>
    <h1 class="sc-hero__title">All Systems Operational</h1>
  </div>
  <div class="row incident-body incident-type-serviceunavailable incident-status-inprogress incident-mostsevere-status-informational">
    <a class="incident-partial-title-url" href="/incident/378791">
      <h2 class="incident-title" aria-label="Incident Title">Update to waitlist disconnect response codes</h2>
    </a>
    <div class="incident-date" aria-label="Incident Date">02 September 2026, 17:05  UTC</div>
  </div>
  <div class="row incident-body incident-type-scheduledmaintenance incident-status-future incident-mostsevere-status-maintenance">
    <a class="incident-partial-title-url" href="/incident/378771">
      <h2 class="incident-title" aria-label="Incident Title">Fastly Support Portal and AI chatbot</h2>
    </a>
    <div class="incident-date" aria-label="Incident Date">10 September 2026, 00:00  UTC</div>
  </div>
</body>
`

const OUTAGE_HTML = `
<h1 class="sc-hero__title">Service Disruption</h1>
<div class="row incident-body incident-type-serviceunavailable incident-status-inprogress incident-mostsevere-status-unavailable">
  <a href="/incident/100">
    <h2 class="incident-title" aria-label="Incident Title">POP connectivity</h2>
  </a>
  <div aria-label="Incident Date">06 September 2026, 12:00  UTC</div>
</div>
`

test("mapStatuscastLabel covers StatusCast hero labels", () => {
  assert.equal(mapStatuscastLabel("All Systems Operational"), "operational")
  assert.equal(mapStatuscastLabel("Informational"), "operational")
  assert.equal(mapStatuscastLabel("Degraded Performance"), "degraded")
  assert.equal(mapStatuscastLabel("Service Disruption"), "partial_outage")
  assert.equal(mapStatuscastLabel("Service Unavailable"), "major_outage")
  assert.equal(mapStatuscastLabel("Maintenance"), "maintenance")
})

test("parseStatuscastHero reads the h1 rollup", () => {
  assert.equal(parseStatuscastHero(FASTLY_HTML), "All Systems Operational")
})

test("parseStatuscastIncidents reads current rows only", () => {
  const incidents = parseStatuscastIncidents(FASTLY_HTML)
  assert.equal(incidents.length, 2)
  assert.equal(incidents[0].id, "378791")
  assert.equal(incidents[0].severity, "informational")
  assert.equal(incidents[0].lifecycle, "inprogress")
  assert.equal(statuscastPaintsCard(incidents[0]), false)
  assert.equal(incidents[1].id, "378771")
  assert.equal(incidents[1].lifecycle, "future")
  assert.equal(statuscastPaintsCard(incidents[1]), false)
})

test("mapStatuscastHtml stays operational for info + future maintenance", () => {
  const state = mapStatuscastHtml(FASTLY_HTML, "https://www.fastlystatus.com")
  assert.equal(state.detail.source, "statuscast")
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 2)
  assert.equal(state.incidents[0].url, "https://www.fastlystatus.com/incident/378791")
  assert.equal(state.incidents[1].status, "scheduled")
})

test("mapStatuscastHtml paints an in-progress disruption", () => {
  const state = mapStatuscastHtml(OUTAGE_HTML, "https://www.fastlystatus.com")
  assert.equal(state.status, "partial_outage")
  assert.equal(state.incidentTitle, "POP connectivity")
  assert.equal(state.incidents[0].status, "investigating")
})

test("mapStatuscastHtml throws when the hero is missing", () => {
  assert.throws(() => mapStatuscastHtml("<html><body>nope</body></html>", "https://example.test"))
})

function item(overrides: Partial<RssItem>): RssItem {
  return {
    externalId: "/706835/1601159",
    title: "Microsoft delivery delays — customer update",
    link: "https://status.campaignmonitor.com/incident/706835",
    publishedAt: "Fri, 04 Sep 2026 06:22:00 -0700",
    text: "We are continuing to monitor delivery of emails to Microsoft domains.",
    categories: [],
    ...overrides,
  }
}

const STATUSCAST_RSS = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:sc="http://statuscast.com">
  <channel>
    <title>Marigold rss feed</title>
    <lastBuildDate>Sun, 06 Sep 2026 05:58:40 -0700</lastBuildDate>
    <item>
      <title>Microsoft delivery delays &#x2014; customer update</title>
      <description>&lt;p&gt;We are continuing to monitor delivery of emails to Microsoft domains. Whilst we have seen some improvement, there unfortunately continues to be a proportion of emails not being delivered successfully.&lt;/p&gt;</description>
      <link>https://status.campaignmonitor.com/incident/706835</link>
      <guid isPermaLink="false">/706835/1601159</guid>
      <pubDate>Fri, 04 Sep 2026 06:22:00 -0700</pubDate>
    </item>
    <item>
      <title>Microsoft delivery delays &#x2014; customer update</title>
      <description>&lt;p&gt;We're aware of an issue currently affecting email delivery to Microsoft domains.&lt;/p&gt;</description>
      <link>https://status.campaignmonitor.com/incident/706835</link>
      <guid isPermaLink="false">/706835/1601034</guid>
      <pubDate>Fri, 04 Sep 2026 04:20:00 -0700</pubDate>
    </item>
    <item>
      <title>Scheduled Maintenance</title>
      <description>&lt;p&gt;We have completed our scheduled maintenance. Emails that were queued may have been delayed.&lt;/p&gt;</description>
      <link>https://status.campaignmonitor.com/incident/697722</link>
      <guid isPermaLink="false">/697722/1583868</guid>
      <pubDate>Sat, 08 Aug 2026 22:10:00 -0700</pubDate>
    </item>
    <item>
      <title>Customers are unable to login to accounts</title>
      <description>&lt;p&gt;The application is now working normally and customers can now login without any issues.&lt;/p&gt;</description>
      <link>https://status.campaignmonitor.com/incident/692706</link>
      <guid isPermaLink="false">/692706/1570509</guid>
      <pubDate>Thu, 16 Jul 2026 05:16:00 -0700</pubDate>
    </item>
  </channel>
</rss>
`

test("statusCastIncidentId reads the incident path or guid", () => {
  assert.equal(statusCastIncidentId(item({})), "706835")
  assert.equal(
    statusCastIncidentId(
      item({
        link: null,
        externalId: "/697722/1583868",
      }),
    ),
    "697722",
  )
})

test("extractStatusCastStatus treats continuing-monitor updates as open", () => {
  assert.equal(extractStatusCastStatus(item({})), "investigating")
})

test("extractStatusCastStatus treats completed maintenance as resolved", () => {
  assert.equal(
    extractStatusCastStatus(
      item({
        title: "Scheduled Maintenance",
        text: "We have completed our scheduled maintenance. Emails that were queued may have been delayed.",
      }),
    ),
    "resolved",
  )
})

test("extractStatusCastStatus treats restored login as resolved", () => {
  assert.equal(
    extractStatusCastStatus(
      item({
        title: "Customers are unable to login to accounts",
        text: "The application is now working normally and customers can now login without any issues.",
      }),
    ),
    "resolved",
  )
})

test("mapStatusCastFeed groups updates and keeps the open Microsoft delay", () => {
  const items = parseFeed(STATUSCAST_RSS)
  const state = mapStatusCastFeed(items, {
    feedUrl: "https://status.campaignmonitor.com/rss",
    feedTitle: "Marigold rss feed",
    lastBuildDate: "Sun, 06 Sep 2026 05:58:40 -0700",
  })

  assert.equal(state.detail.source, "statuscast")
  assert.equal(state.components.length, 0)
  assert.equal(state.incidents.length, 3)
  assert.equal(state.incidents[0].externalId, "706835")
  assert.equal(state.incidents[0].status, "investigating")
  assert.equal(state.incidents[1].externalId, "697722")
  assert.equal(state.incidents[1].status, "resolved")
  assert.equal(state.incidents[2].status, "resolved")
  assert.equal(state.status, "degraded")
  assert.match(state.incidentTitle ?? "", /Microsoft delivery delays/)
})
