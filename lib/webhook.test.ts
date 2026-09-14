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
  testWebhookServices,
  webhookDisabledNote,
  webhookTextSummary,
  WEBHOOK_EVENT_TYPE_ALERT,
  WEBHOOK_EVENT_TYPE_TEST,
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
  const payload = buildWebhookPayload(services, "https://www.statussy.com/", {
    id: "evt_test",
    createdAt: "2026-09-11T18:01:00.000Z",
  })
  assert.equal(payload.id, "evt_test")
  assert.equal(payload.type, WEBHOOK_EVENT_TYPE_ALERT)
  assert.equal(payload.createdAt, "2026-09-11T18:01:00.000Z")
  assert.equal(payload.text, payload.data.text)
  assert.doesNotMatch(payload.data.text, /^Statussy:/)
  assert.doesNotMatch(payload.data.text, /\u2014/)
  assert.equal(payload.data.services.length, 2)
  assert.deepEqual(payload.data.services[0], {
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
  assert.equal(payload.data.services[1]?.checkedAt, "2026-09-11T18:01:00.000Z")
  assert.equal(payload.data.services[1]?.officialStatusUrl, null)
  assert.equal(payload.data.boardUrl, "https://www.statussy.com")
})

test("text summary is a one-line list of providers with outage type", () => {
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
    "OpenAI (Major outage), Anthropic (Partial outage)"
  )
})

test("Send test uses the same payload layout as a live batch", () => {
  const checkedAt = "2026-09-11T18:00:00.000Z"
  const services = testWebhookServices("https://www.statussy.com", checkedAt)
  const payload = buildTestWebhookPayload("https://www.statussy.com", checkedAt)
  assert.deepEqual(
    payload,
    buildWebhookPayload(services, "https://www.statussy.com", {
      type: WEBHOOK_EVENT_TYPE_TEST,
      createdAt: checkedAt,
      id: payload.id,
    })
  )
  assert.equal(payload.type, WEBHOOK_EVENT_TYPE_TEST)
  assert.match(payload.id, /^evt_[0-9a-f]{32}$/)
  assert.equal(payload.createdAt, checkedAt)
  assert.equal(payload.text, webhookTextSummary(services))
  assert.equal(payload.data.text, webhookTextSummary(services))
  assert.equal(
    payload.data.text,
    "OpenAI (Major outage), Anthropic (Partial outage)"
  )
  assert.equal(payload.data.services.length, 2)
  assert.equal(payload.data.services[0]?.serviceId, "openai")
  assert.equal(payload.data.services[0]?.incidentTitle, "API elevated errors")
  assert.equal(payload.data.services[1]?.serviceId, "anthropic")
  assert.equal(payload.data.services[1]?.incidentTitle, null)
  assert.doesNotMatch(payload.data.text, /webhook delivery is working/)
  assert.doesNotMatch(payload.data.text, /^Statussy:/)
  assert.equal(payload.data.boardUrl, "https://www.statussy.com")
})

test("serialized payload is an event envelope for every destination", () => {
  const payload = buildWebhookPayload(
    testWebhookServices("https://www.statussy.com", "2026-09-11T18:00:00.000Z"),
    "https://www.statussy.com",
    {
      id: "evt_fixed",
      createdAt: "2026-09-11T18:00:00.000Z",
    }
  )
  const body = JSON.parse(serializeWebhookPayload(payload)) as {
    id?: string
    type?: string
    createdAt?: string
    text?: string
    boardUrl?: string
    attachments?: unknown
    blocks?: unknown
    services?: unknown
    data?: {
      text?: string
      boardUrl?: string
      services?: unknown
    }
  }
  assert.equal(body.id, "evt_fixed")
  assert.equal(body.type, WEBHOOK_EVENT_TYPE_ALERT)
  assert.equal(body.createdAt, "2026-09-11T18:00:00.000Z")
  assert.equal(body.text, payload.text)
  assert.equal(body.text, payload.data.text)
  assert.equal(body.boardUrl, undefined)
  assert.equal(body.services, undefined)
  assert.equal(body.attachments, undefined)
  assert.equal(body.blocks, undefined)
  assert.equal(body.data?.text, payload.data.text)
  assert.equal(body.data?.boardUrl, payload.data.boardUrl)
  assert.equal(Array.isArray(body.data?.services), true)
})

test("serialized body has top-level text so Incoming Webhooks do not return no_text", () => {
  const body = JSON.parse(
    serializeWebhookPayload(
      buildWebhookPayload(
        testWebhookServices(
          "https://www.statussy.com",
          "2026-09-11T18:00:00.000Z"
        )
      )
    )
  ) as { text?: unknown }
  assert.equal(typeof body.text, "string")
  assert.notEqual(body.text, "")
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
