import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  collectTransitions,
  createResendMailer,
  digestAttentionTitle,
  digestForUser,
  digestHtmlBody,
  digestMarkUrl,
  digestPollId,
  digestPrefsUrl,
  digestResendHeaders,
  digestSubject,
  digestTextBody,
  filterDigestItems,
  groupUserDigests,
  isDigestTransition,
  isPartialCooldownActive,
  PARTIAL_COOLDOWN_MS,
  qualifyingDigestItems,
  pairsFromSnapshotRows,
  type DigestUser,
  type StatusTransition,
} from "../src/digest.js"

const BOTH_ON = { notifyMajor: true, notifyPartial: true } as const

function user(
  userId: string,
  email: string,
  favoriteIds: string[],
  prefs: { notifyMajor: boolean; notifyPartial: boolean } = BOTH_ON
): DigestUser {
  return { userId, email, favoriteIds, ...prefs }
}

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
      statusUrl: "https://status.openai.com/",
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
  assert.equal(items[0]?.statusUrl, "https://status.openai.com/")
  assert.equal(items[1]?.statusUrl, undefined)
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
    user("u1", "a@example.com", ["openai", "anthropic", "vercel"]),
    user("u2", "b@example.com", ["vercel"]),
    user("u3", "c@example.com", ["stripe"]),
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
    user("u1", "a@example.com", ["openai", "vercel"]),
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

test("digestPrefsUrl points at Settings for List-Unsubscribe", () => {
  assert.equal(
    digestPrefsUrl("https://www.statussy.com/"),
    "https://www.statussy.com/settings"
  )
  assert.deepEqual(digestResendHeaders("https://www.statussy.com"), {
    "List-Unsubscribe": "<https://www.statussy.com/settings>",
  })
})

test("digestAttentionTitle is singular or plural", () => {
  assert.equal(digestAttentionTitle(1), "1 service needs attention")
  assert.equal(digestAttentionTitle(3), "3 services need attention")
})

test("digest body is a black Grok-like column with pills, CTA, and footer links", () => {
  const items = [
    {
      serviceId: "openai",
      name: "OpenAI",
      from: "operational" as const,
      to: "major_outage" as const,
      statusUrl: "https://status.openai.com/",
    },
    {
      serviceId: "anthropic",
      name: "Anthropic",
      from: "operational" as const,
      to: "partial_outage" as const,
    },
  ]
  const text = digestTextBody(items, "https://www.statussy.com")
  assert.match(text, /Stack alert/)
  assert.match(text, /2 services need attention/)
  assert.match(text, /OpenAI/)
  assert.match(text, /Major outage/)
  assert.match(text, /https:\/\/www\.statussy\.com\/services\/openai/)
  assert.match(text, /Official status: https:\/\/status\.openai\.com\//)
  assert.match(text, /Anthropic/)
  assert.match(text, /Partial outage/)
  assert.match(
    text,
    /Anthropic\nPartial outage\nhttps:\/\/www\.statussy\.com\/services\/anthropic\n\nOpen your board/
  )
  assert.match(text, /Open your board: https:\/\/www\.statussy\.com/)
  assert.match(
    text,
    /Manage digest prefs: https:\/\/www\.statussy\.com\/settings/
  )
  assert.match(text, /Unsubscribe: https:\/\/www\.statussy\.com\/settings/)
  assert.match(text, /© SmartScale Solutions LLC/)
  assert.match(text, /statussy\.com/)
  assert.doesNotMatch(text, /—/)

  const html = digestHtmlBody(items, "https://www.statussy.com/")
  assert.match(html, /#000000/)
  assert.match(html, /max-width:480px/)
  assert.doesNotMatch(html, /#111111/)
  assert.doesNotMatch(html, /border-radius:12px/)
  assert.match(html, /Statussy/)
  assert.match(html, /Stack alert/)
  assert.match(html, /2 services need attention/)
  assert.match(html, /https:\/\/www\.statussy\.com\/services\/openai/)
  assert.match(html, /OpenAI/)
  assert.match(html, /Major outage/)
  assert.match(html, /Partial outage/)
  assert.match(html, /https:\/\/status\.openai\.com\//)
  assert.match(html, /Official status/)
  assert.match(html, /Open your board/)
  assert.doesNotMatch(html, /text-decoration:underline;">Open your board/)
  assert.match(html, /Manage digest prefs/)
  assert.match(html, /Unsubscribe/)
  assert.match(html, /https:\/\/www\.statussy\.com\/settings/)
  assert.match(html, /SmartScale Solutions LLC/)
  assert.match(html, />statussy\.com</)
  assert.equal(
    html.includes(digestMarkUrl("https://www.statussy.com/")),
    true
  )
  assert.doesNotMatch(html, /—/)
})

test("digest HTML preview fixture matches the renderer", () => {
  const html = digestHtmlBody(
    [
      {
        serviceId: "openai",
        name: "OpenAI",
        from: "operational",
        to: "major_outage",
        statusUrl: "https://status.openai.com/",
      },
      {
        serviceId: "anthropic",
        name: "Anthropic",
        from: "operational",
        to: "partial_outage",
      },
    ],
    "https://www.statussy.com"
  )
  const fixture = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "fixtures/digest-email-preview.html"
    ),
    "utf8"
  )
  assert.equal(`${html}\n`, fixture)
})

test("official status is omitted without a safe http(s) URL", () => {
  const items = [
    {
      serviceId: "openai",
      name: "OpenAI",
      from: "operational" as const,
      to: "major_outage" as const,
      statusUrl: "javascript:alert(1)",
    },
  ]
  const text = digestTextBody(items, "https://www.statussy.com")
  assert.doesNotMatch(text, /Official status/)
  assert.doesNotMatch(text, /javascript:/)
  const html = digestHtmlBody(items, "https://www.statussy.com")
  assert.doesNotMatch(html, /Official status/)
  assert.doesNotMatch(html, /javascript:/)
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
      status_url: "https://status.openai.com/",
      rn: 1,
    },
    {
      service_id: "openai",
      name: "OpenAI",
      snapshot_id: "9",
      status: "operational",
      status_url: "https://status.openai.com/",
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
        statusUrl: "https://status.openai.com/",
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

const MAJOR: StatusTransition = {
  serviceId: "openai",
  name: "OpenAI",
  from: "operational",
  to: "major_outage",
}
const PARTIAL: StatusTransition = {
  serviceId: "anthropic",
  name: "Anthropic",
  from: "operational",
  to: "partial_outage",
}
const HOUR = 60 * 60 * 1000

test("filterDigestItems honors Major vs Partial toggles", () => {
  const now = Date.now()
  const empty = new Map<string, number>()
  assert.deepEqual(
    filterDigestItems([MAJOR, PARTIAL], BOTH_ON, empty, now).map(
      (item) => item.serviceId
    ),
    ["openai", "anthropic"]
  )
  assert.deepEqual(
    filterDigestItems(
      [MAJOR, PARTIAL],
      { notifyMajor: true, notifyPartial: false },
      empty,
      now
    ).map((item) => item.serviceId),
    ["openai"]
  )
  assert.deepEqual(
    filterDigestItems(
      [MAJOR, PARTIAL],
      { notifyMajor: false, notifyPartial: true },
      empty,
      now
    ).map((item) => item.serviceId),
    ["anthropic"]
  )
  assert.deepEqual(
    filterDigestItems(
      [MAJOR, PARTIAL],
      { notifyMajor: false, notifyPartial: false },
      empty,
      now
    ),
    []
  )
})

test("Partial cooldown suppresses 5h59 and allows 6h01; Major is unaffected", () => {
  const now = Date.parse("2026-09-10T12:00:00.000Z")
  const lastPartial = new Map<string, number>([
    ["anthropic", now - (6 * HOUR - 60 * 1000)],
  ])
  assert.equal(
    isPartialCooldownActive(lastPartial.get("anthropic"), now),
    true
  )
  assert.deepEqual(
    filterDigestItems([MAJOR, PARTIAL], BOTH_ON, lastPartial, now).map(
      (item) => item.serviceId
    ),
    ["openai"]
  )

  const afterWindow = new Map<string, number>([
    ["anthropic", now - (6 * HOUR + 60 * 1000)],
  ])
  assert.equal(
    isPartialCooldownActive(afterWindow.get("anthropic"), now),
    false
  )
  assert.deepEqual(
    filterDigestItems([MAJOR, PARTIAL], BOTH_ON, afterWindow, now).map(
      (item) => item.serviceId
    ),
    ["openai", "anthropic"]
  )
  assert.equal(PARTIAL_COOLDOWN_MS, 6 * HOUR)
})

test("qualifyingDigestItems still batches one digest when several favorites qualify", () => {
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
  const items = qualifyingDigestItems(
    user("u1", "a@example.com", ["openai", "anthropic", "vercel"]),
    transitions,
    new Map(),
    Date.now()
  )
  assert.deepEqual(
    items.map((item) => item.serviceId),
    ["openai", "anthropic", "vercel"]
  )
})

test("createResendMailer posts Statussy from and List-Unsubscribe, never smartaiscaling.com", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response("{}", { status: 200 })
  }) as typeof fetch
  try {
    const mailer = createResendMailer(
      "re_test",
      "noreply@smartaiscaling.com",
      "https://www.statussy.com"
    )
    await mailer({
      to: "user@example.com",
      subject: digestSubject(1),
      text: "body",
      html: "<p>body</p>",
    })
  } finally {
    globalThis.fetch = original
  }
  assert.equal(calls.length, 1)
  const body = JSON.parse(String(calls[0]?.init.body)) as {
    from: string
    to: string
    subject: string
    headers: Record<string, string>
  }
  assert.equal(body.from, "Statussy <noreply@statussy.com>")
  assert.doesNotMatch(body.from, /smartaiscaling/)
  assert.equal(body.to, "user@example.com")
  assert.equal(body.subject, "Statussy: 1 service in your stack needs attention")
  assert.equal(
    body.headers["List-Unsubscribe"],
    "<https://www.statussy.com/settings>"
  )
})
