import assert from "node:assert/strict"
import test from "node:test"
import { parseFeed } from "../src/rss.js"
import {
  isRedisIncidentOpen,
  mapRedis,
  mapRedisCondition,
  mapRedisRss,
  mapRedisSeveritySlug,
  type RedisPayload,
} from "../src/redis.js"

const COMPONENTS = [
  { id: "admin", name: "Admin Console" },
  { id: "api", name: "REST API" },
  { id: "dns", name: "DNS Resolvers" },
  { id: "lang", name: "LangCache" },
  { id: "radar", name: "Redis Radar" },
  { id: "heroku", name: "Heroku Integration" },
  { id: "support", name: "Support Site" },
]

test("mapRedisCondition and severity slugs cover Nunc labels", () => {
  assert.equal(mapRedisCondition("Degraded"), "degraded")
  assert.equal(mapRedisCondition("Unavailable"), "major_outage")
  assert.equal(mapRedisCondition("Maintenance"), "maintenance")
  assert.equal(mapRedisCondition("Operational"), "operational")
  assert.equal(mapRedisCondition("nope"), "unknown")
  assert.equal(mapRedisSeveritySlug("MAINTENANCE"), "maintenance")
  assert.equal(mapRedisSeveritySlug("SEV1"), "major_outage")
  assert.equal(mapRedisSeveritySlug("UNSET"), "unknown")
})

test("mapRedis is operational when the message says no active incidents", () => {
  const payload: RedisPayload = {
    config: {
      title: "Redis Service Health",
      operationalMessage: "Currently, there are no active incidents.",
    },
    components: COMPONENTS,
    incidents: [
      {
        id: "old",
        title: "Urgent maintenance",
        timestamps: {
          started: "2026-01-08T15:41:13Z",
          resolved: "2026-01-08T16:06:48Z",
        },
        severitySlug: "UNSET",
      },
    ],
  }
  const state = mapRedis(payload)
  assert.equal(state.status, "operational")
  assert.equal(state.incidentTitle, null)
  assert.equal(state.detail.source, "nunc")
  assert.equal(state.detail.openIncidentCount, 0)
  assert.equal(state.components.length, 7)
  assert.ok(state.components.every((component) => component.status === "operational"))
  assert.equal(state.incidents[0].status, "resolved")
  assert.equal(state.incidents[0].url, "https://status.redis.io/incidents/old")
})

test("mapRedis paints open incidents and named services", () => {
  const state = mapRedis({
    config: { operationalMessage: "REST API is degraded." },
    components: COMPONENTS,
    incidents: [
      {
        id: "open-1",
        title: "REST API latency",
        timestamps: { started: "2026-09-06T12:00:00Z" },
        severitySlug: "UNSET",
        componentConditions: { "REST API": "Degraded" },
        components: [{ id: "api", name: "REST API", condition: "Degraded" }],
      },
    ],
  })
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "REST API latency")
  assert.equal(state.detail.openIncidentCount, 1)
  assert.equal(state.components.find((component) => component.name === "REST API")?.status, "degraded")
  assert.equal(state.components.find((component) => component.name === "Admin Console")?.status, "operational")
  assert.equal(isRedisIncidentOpen({ timestamps: { started: "2026-09-06T12:00:00Z" } }), true)
})

test("mapRedis uses operationalMessage when there are no open incidents", () => {
  const state = mapRedis({
    config: { operationalMessage: "Investigating elevated errors on DNS Resolvers." },
    components: COMPONENTS,
    incidents: [],
  })
  assert.equal(state.status, "degraded")
  assert.equal(state.incidentTitle, "Investigating elevated errors on DNS Resolvers.")
})

test("mapRedisRss collapses updates and respects resolved milestones", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Redis Service Health Status</title>
  <item>
    <title>Update for incident "Redis Cloud – Temporary Issues with Redis IRIS"</title>
    <link>https://status.redis.io/incidents/42e1b31a-dd30-41ad-9f42-349b77d24f2d</link>
    <description>Milestone is now 'resolved'. Previously milestone was 'investigating'</description>
    <pubDate>Sat, 05 Sep 2026 13:39:48 +0000</pubDate>
    <guid>https://status.redis.io/incidents/42e1b31a-dd30-41ad-9f42-349b77d24f2d#2</guid>
  </item>
  <item>
    <title>New incident: "Redis Cloud – Temporary Issues with Redis IRIS"</title>
    <link>https://status.redis.io/incidents/42e1b31a-dd30-41ad-9f42-349b77d24f2d</link>
    <pubDate>Sat, 05 Sep 2026 12:58:29 +0000</pubDate>
    <guid>https://status.redis.io/incidents/42e1b31a-dd30-41ad-9f42-349b77d24f2d</guid>
  </item>
</channel></rss>`
  const state = mapRedisRss(parseFeed(xml))
  assert.equal(state.status, "operational")
  assert.equal(state.incidents.length, 1)
  assert.equal(state.incidents[0].status, "resolved")
  assert.equal(state.incidents[0].title, "Redis Cloud – Temporary Issues with Redis IRIS")
  assert.equal(state.detail.source, "nunc-rss")
})

test("mapRedisRss paints an open investigating incident", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>New incident: "Regional network outage"</title>
    <link>https://status.redis.io/incidents/aaaa1111-bbbb-cccc-dddd-eeeeffff0000</link>
    <description>We’re currently investigating an issue.</description>
    <pubDate>Sun, 06 Sep 2026 12:00:00 +0000</pubDate>
    <guid>https://status.redis.io/incidents/aaaa1111-bbbb-cccc-dddd-eeeeffff0000</guid>
  </item>
</channel></rss>`
  const state = mapRedisRss(parseFeed(xml))
  assert.equal(state.status, "partial_outage")
  assert.equal(state.incidentTitle, "Regional network outage")
  assert.equal(state.incidents[0].status, "investigating")
})
