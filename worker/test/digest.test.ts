import assert from "node:assert/strict"
import { test } from "node:test"

import {
  collectTransitions,
  digestForUser,
  digestHtmlBody,
  digestPollId,
  digestSubject,
  digestTextBody,
  groupUserDigests,
  isDigestTransition,
  pairsFromSnapshotRows,
} from "../src/digest.js"

test("isDigestTransition keeps only into Major/Partial from a healthier state", () => {
  assert.equal(isDigestTransition("operational", "major_outage"), true)
  assert.equal(isDigestTransition("operational", "partial_outage"), true)
  assert.equal(isDigestTransition("degraded", "partial_outage"), true)
  assert.equal(isDigestTransition("degraded", "major_outage"), true)
  assert.equal(isDigestTransition("partial_outage", "major_outage"), true)
  assert.equal(isDigestTransition("maintenance", "partial_outage"), true)
  assert.equal(isDigestTransition("unknown", "major_outage"), true)
})

test("isDigestTransition skips recoveries, still-bad, and Degraded-only", () => {
  assert.equal(isDigestTransition("major_outage", "operational"), false)
  assert.equal(isDigestTransition("partial_outage", "operational"), false)
  assert.equal(isDigestTransition("major_outage", "partial_outage"), false)
  assert.equal(isDigestTransition("major_outage", "major_outage"), false)
  assert.equal(isDigestTransition("partial_outage", "partial_outage"), false)
  assert.equal(isDigestTransition("operational", "degraded"), false)
  assert.equal(isDigestTransition("degraded", "degraded"), false)
  assert.equal(isDigestTransition("operational", "maintenance"), false)
  assert.equal(isDigestTransition("operational", "operational"), false)
  assert.equal(isDigestTransition(null, "major_outage"), false)
  assert.equal(isDigestTransition(null, "partial_outage"), false)
})

test("collectTransitions filters the pair list", () => {
  const items = collectTransitions([
    {
      serviceId: "openai",
      name: "OpenAI",
      previous: "operational",
      current: "major_outage",
    },
    {
      serviceId: "anthropic",
      name: "Anthropic",
      previous: "major_outage",
      current: "operational",
    },
    {
      serviceId: "groq",
      name: "Groq",
      previous: "partial_outage",
      current: "partial_outage",
    },
    {
      serviceId: "vercel",
      name: "Vercel",
      previous: "operational",
      current: "degraded",
    },
    {
      serviceId: "railway",
      name: "Railway",
      previous: null,
      current: "major_outage",
    },
    {
      serviceId: "github",
      name: "GitHub",
      previous: "degraded",
      current: "partial_outage",
    },
  ])
  assert.deepEqual(
    items.map((item) => item.serviceId),
    ["openai", "github"]
  )
})

test("groupUserDigests batches many favorite transitions into one digest per user", () => {
  const transitions = collectTransitions([
    {
      serviceId: "openai",
      name: "OpenAI",
      previous: "operational",
      current: "major_outage",
    },
    {
      serviceId: "anthropic",
      name: "Anthropic",
      previous: "operational",
      current: "partial_outage",
    },
    {
      serviceId: "vercel",
      name: "Vercel",
      previous: "operational",
      current: "partial_outage",
    },
  ])
  assert.equal(transitions.length, 3)

  const users = [
    {
      userId: "u1",
      email: "a@example.com",
      favoriteIds: ["openai", "anthropic", "vercel"],
    },
    { userId: "u2", email: "b@example.com", favoriteIds: ["vercel"] },
    { userId: "u3", email: "c@example.com", favoriteIds: ["stripe"] },
  ]
  const digests = groupUserDigests(users, transitions)
  assert.equal(digests.length, 2)
  assert.equal(digests[0]?.user.userId, "u1")
  assert.deepEqual(
    digests[0]?.items.map((item) => item.serviceId),
    ["openai", "anthropic", "vercel"]
  )
  assert.equal(digests[1]?.user.userId, "u2")
  assert.deepEqual(
    digests[1]?.items.map((item) => item.serviceId),
    ["vercel"]
  )
})

test("digestForUser ignores non-favorites and sorts Major before Partial", () => {
  const items = digestForUser(
    { userId: "u1", email: "a@example.com", favoriteIds: ["openai", "vercel"] },
    [
      {
        serviceId: "vercel",
        name: "Vercel",
        from: "operational",
        to: "partial_outage",
      },
      {
        serviceId: "anthropic",
        name: "Anthropic",
        from: "operational",
        to: "major_outage",
      },
      {
        serviceId: "openai",
        name: "OpenAI",
        from: "operational",
        to: "major_outage",
      },
    ]
  )
  assert.deepEqual(
    items.map((item) => item.serviceId),
    ["openai", "vercel"]
  )
})

test("digestSubject matches the Statussy N-services copy", () => {
  assert.equal(
    digestSubject(1),
    "Statussy: 1 service in your stack needs attention"
  )
  assert.equal(
    digestSubject(3),
    "Statussy: 3 services in your stack need attention"
  )
})

test("digest body lists names, statuses, and a board link", () => {
  const items = [
    {
      serviceId: "openai",
      name: "OpenAI",
      from: "operational" as const,
      to: "major_outage" as const,
    },
  ]
  const text = digestTextBody(items, "https://www.statussy.com")
  assert.match(text, /OpenAI: Major outage/)
  assert.match(text, /https:\/\/www\.statussy\.com\/services\/openai/)
  assert.match(text, /Open your board: https:\/\/www\.statussy\.com/)
  const html = digestHtmlBody(items, "https://www.statussy.com/")
  assert.match(html, /Statussy/)
  assert.match(html, /OpenAI/)
  assert.match(html, /Major outage/)
})

test("digestPollId is stable for the same snapshot set", () => {
  assert.equal(digestPollId([3, 1, 2]), digestPollId([1, 2, 3]))
  assert.notEqual(digestPollId([1, 2]), digestPollId([1, 2, 3]))
})

test("pairsFromSnapshotRows maps latest vs previous per service", () => {
  const { pairs, snapshotIds } = pairsFromSnapshotRows([
    {
      service_id: "openai",
      name: "OpenAI",
      snapshot_id: "10",
      status: "major_outage",
      rn: 1,
    },
    {
      service_id: "openai",
      name: "OpenAI",
      snapshot_id: "9",
      status: "operational",
      rn: 2,
    },
    {
      service_id: "vercel",
      name: "Vercel",
      snapshot_id: "5",
      status: "operational",
      rn: 1,
    },
  ])
  assert.deepEqual(snapshotIds.sort(), ["10", "5"])
  assert.deepEqual(
    pairs.sort((a, b) => a.serviceId.localeCompare(b.serviceId)),
    [
      {
        serviceId: "openai",
        name: "OpenAI",
        previous: "operational",
        current: "major_outage",
      },
      {
        serviceId: "vercel",
        name: "Vercel",
        previous: null,
        current: "operational",
      },
    ]
  )
})
