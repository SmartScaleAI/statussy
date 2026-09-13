import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyWebhookFailure,
  buildWebhookPayload,
  buildWebhookServices,
  deliverWebhook,
  isBlockedWebhookHost,
  parseWebhookUrl,
  serializeWebhookPayload,
  signWebhookBody,
  buildTestWebhookPayload,
  isSlackIncomingWebhookUrl,
  testWebhookServices,
  webhookDisabledNote,
  webhookTextSummary,
  WEBHOOK_ATTACHMENT_COLOR_MAJOR,
  WEBHOOK_ATTACHMENT_COLOR_PARTIAL,
  WEBHOOK_BOARD_BUTTON_LABEL,
  WEBHOOK_HARD_FAILURE_LIMIT,
  WEBHOOK_SIGNATURE_HEADER,
} from "./webhook.ts"

test("parseWebhookUrl accepts public HTTPS URLs", () => {
  const parsed = parseWebhookUrl("https://example.com/webhook")
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.url, "https://example.com/webhook")
  }
})

test("parseWebhookUrl rejects http, junk, and private hosts", () => {
  assert.equal(parseWebhookUrl("").ok, false)
  assert.equal(parseWebhookUrl("not-a-url").ok, false)
  assert.equal(parseWebhookUrl("http://example.com/hook").ok, false)
  assert.equal(parseWebhookUrl("https://localhost/hook").ok, false)
  assert.equal(parseWebhookUrl("https://127.0.0.1/hook").ok, false)
  assert.equal(parseWebhookUrl("https://10.0.0.4/hook").ok, false)
  assert.equal(parseWebhookUrl("https://192.168.1.5/hook").ok, false)
  assert.equal(parseWebhookUrl("https://172.16.0.8/hook").ok, false)
  assert.equal(parseWebhookUrl("https://169.254.169.254/hook").ok, false)
  assert.equal(isBlockedWebhookHost("example.com"), false)
})

test("payload is one batched object with text plus service fields", () => {
  const services = buildWebhookServices(
    [
      {
        serviceId: "openai",
        name: "OpenAI",
        from: "operational",
        to: "major_outage",
        statusUrl: "https://status.openai.com/",
        checkedAt: "2026-09-11T18:00:00.000Z",
      },
      {
        serviceId: "anthropic",
        name: "Anthropic",
        from: "degraded",
        to: "partial_outage",
      },
    ],
    "https://www.statussy.com/",
    "2026-09-11T18:01:00.000Z"
  )
  const payload = buildWebhookPayload(services)
  assert.doesNotMatch(payload.text, /^Statussy:/)
  assert.doesNotMatch(payload.text, /\u2014/)
  assert.equal(payload.services.length, 2)
  assert.deepEqual(payload.services[0], {
    serviceId: "openai",
    name: "OpenAI",
    fromStatus: "operational",
    toStatus: "major_outage",
    checkedAt: "2026-09-11T18:00:00.000Z",
    officialStatusUrl: "https://status.openai.com/",
    statussyUrl: "https://www.statussy.com/services/openai",
    incidentTitle: null,
    incidentUrl: null,
  })
  assert.equal(payload.services[1]?.checkedAt, "2026-09-11T18:01:00.000Z")
  assert.equal(payload.services[1]?.officialStatusUrl, null)
  assert.equal(payload.boardUrl, "https://www.statussy.com")
  assert.equal(payload.attachments[0]?.color, WEBHOOK_ATTACHMENT_COLOR_MAJOR)
  assert.equal(payload.attachments[0]?.text, payload.text)
  assert.equal(
    payload.attachments[0]?.blocks[1]?.type,
    "actions"
  )
})

test("text summary puts each service on its own line", () => {
  assert.equal(
    webhookTextSummary([
      {
        serviceId: "openai",
        name: "OpenAI",
        fromStatus: "operational",
        toStatus: "major_outage",
        checkedAt: "2026-09-11T18:00:00.000Z",
        officialStatusUrl: null,
        statussyUrl: "https://www.statussy.com/services/openai",
        incidentTitle: null,
        incidentUrl: null,
      },
    ]),
    "OpenAI (Major outage)"
  )
})

test("text summary puts the active incident on the line below the service", () => {
  assert.equal(
    webhookTextSummary([
      {
        serviceId: "openai",
        name: "OpenAI",
        fromStatus: "operational",
        toStatus: "major_outage",
        checkedAt: "2026-09-11T18:00:00.000Z",
        officialStatusUrl: null,
        statussyUrl: "https://www.statussy.com/services/openai",
        incidentTitle: "API elevated errors",
        incidentUrl: "https://status.openai.com/incidents/abc",
      },
      {
        serviceId: "anthropic",
        name: "Anthropic",
        fromStatus: "operational",
        toStatus: "partial_outage",
        checkedAt: "2026-09-11T18:00:00.000Z",
        officialStatusUrl: null,
        statussyUrl: "https://www.statussy.com/services/anthropic",
        incidentTitle: null,
        incidentUrl: null,
      },
    ]),
    "OpenAI (Major outage)\nAPI elevated errors\nAnthropic (Partial outage)"
  )
})

test("Send test uses the same payload layout as a live batch", () => {
  const checkedAt = "2026-09-11T18:00:00.000Z"
  const services = testWebhookServices("https://www.statussy.com", checkedAt)
  const payload = buildTestWebhookPayload("https://www.statussy.com", checkedAt)
  assert.deepEqual(payload, buildWebhookPayload(services, "https://www.statussy.com"))
  assert.equal(payload.text, webhookTextSummary(services))
  assert.equal(
    payload.text,
    "OpenAI (Major outage)\nAPI elevated errors\nAnthropic (Partial outage)"
  )
  assert.equal(payload.services.length, 2)
  assert.equal(payload.services[0]?.serviceId, "openai")
  assert.equal(payload.services[0]?.incidentTitle, "API elevated errors")
  assert.equal(payload.services[1]?.serviceId, "anthropic")
  assert.equal(payload.services[1]?.incidentTitle, null)
  assert.doesNotMatch(payload.text, /webhook delivery is working/)
  assert.doesNotMatch(payload.text, /^Statussy:/)
  assert.equal(payload.attachments[0]?.color, WEBHOOK_ATTACHMENT_COLOR_MAJOR)
  const boardButton = payload.attachments[0]?.blocks[1]
  assert.equal(boardButton?.type, "actions")
  if (boardButton?.type === "actions") {
    assert.equal(boardButton.elements[0]?.text.text, WEBHOOK_BOARD_BUTTON_LABEL)
    assert.equal(boardButton.elements[0]?.url, "https://www.statussy.com")
  }
})

test("partial-only batches use the amber attachment rail", () => {
  const services = buildWebhookServices(
    [
      {
        serviceId: "anthropic",
        name: "Anthropic",
        from: "operational",
        to: "partial_outage",
      },
    ],
    "https://www.statussy.com",
    "2026-09-11T18:00:00.000Z"
  )
  const payload = buildWebhookPayload(services)
  assert.equal(payload.attachments[0]?.color, WEBHOOK_ATTACHMENT_COLOR_PARTIAL)
})

test("Slack Incoming Webhooks omit top-level text so the rail is not duplicated", () => {
  const payload = buildWebhookPayload(
    testWebhookServices(
      "https://www.statussy.com",
      "2026-09-11T18:00:00.000Z"
    )
  )
  assert.equal(
    isSlackIncomingWebhookUrl(
      "https://hooks.slack.com/services/T000/B000/XXXX"
    ),
    true
  )
  assert.equal(
    isSlackIncomingWebhookUrl("https://example.com/webhook"),
    false
  )
  const slackBody = JSON.parse(
    serializeWebhookPayload(
      payload,
      "https://hooks.slack.com/services/T000/B000/XXXX"
    )
  ) as {
    text?: string
    services?: unknown
    attachments?: Array<{
      color?: string
      fallback?: string
      text?: string
      actions?: unknown
      blocks?: unknown
    }>
  }
  assert.equal(slackBody.text, undefined)
  assert.equal(slackBody.services, undefined)
  assert.equal(slackBody.attachments?.[0]?.text, undefined)
  assert.equal(slackBody.attachments?.[0]?.actions, undefined)
  assert.equal(slackBody.attachments?.[0]?.color, payload.attachments[0]?.color)
  assert.deepEqual(slackBody.attachments?.[0]?.blocks, payload.attachments[0]?.blocks)

  const genericBody = JSON.parse(
    serializeWebhookPayload(payload, "https://example.com/webhook")
  ) as {
    text?: string
    boardUrl?: string
    attachments?: Array<{ text?: string; blocks?: unknown; actions?: unknown }>
    services?: unknown
  }
  assert.equal(genericBody.text, payload.text)
  assert.equal(genericBody.boardUrl, payload.boardUrl)
  assert.equal(genericBody.attachments?.[0]?.text, payload.text)
  assert.equal(genericBody.attachments?.[0]?.blocks, undefined)
  assert.equal(genericBody.attachments?.[0]?.actions, undefined)
  assert.equal(Array.isArray(genericBody.services), true)
})

test("HMAC header is sha256 of the exact serialized body", () => {
  const body = serializeWebhookPayload(
    buildWebhookPayload(
      testWebhookServices(
        "https://www.statussy.com",
        "2026-09-11T18:00:00.000Z"
      )
    )
  )
  const header = signWebhookBody("stsy_testsecret", body)
  assert.match(header, /^sha256=[0-9a-f]{64}$/)
  assert.equal(signWebhookBody("stsy_testsecret", body), header)
  assert.notEqual(signWebhookBody("other", body), header)
})

test("deliverWebhook signs the POST and does not retry 4xx", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response("invalid_token", { status: 403 })
  }) as typeof fetch
  const body = '{"text":"hi","services":[]}'
  const result = await deliverWebhook({
    url: "https://example.com/webhook",
    secret: "stsy_secret",
    body,
    fetchImpl,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.error, /403/)
  }
  assert.equal(calls.length, 1)
  const headers = calls[0]?.init.headers as Record<string, string>
  assert.equal(
    headers[WEBHOOK_SIGNATURE_HEADER],
    signWebhookBody("stsy_secret", body)
  )
  assert.equal(headers["content-type"], "application/json")
})

test("deliverWebhook retries 5xx then counts one hard failure", async () => {
  let hits = 0
  const fetchImpl = (async () => {
    hits += 1
    return new Response("oops", { status: 502 })
  }) as typeof fetch
  const result = await deliverWebhook({
    url: "https://example.com/hook",
    secret: "stsy_secret",
    body: "{}",
    maxAttempts: 3,
    fetchImpl,
  })
  assert.equal(result.ok, false)
  assert.equal(hits, 3)
  const first = applyWebhookFailure(0)
  const second = applyWebhookFailure(first.consecutiveFailures)
  const third = applyWebhookFailure(second.consecutiveFailures)
  assert.equal(first.enabled, true)
  assert.equal(second.enabled, true)
  assert.equal(third.enabled, false)
  assert.equal(third.consecutiveFailures, WEBHOOK_HARD_FAILURE_LIMIT)
  assert.match(
    webhookDisabledNote(third.disabledReason, "HTTP 502") ?? "",
    /3 failed deliveries/
  )
})
