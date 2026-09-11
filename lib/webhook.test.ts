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
  testWebhookServices,
  webhookDisabledNote,
  webhookTextSummary,
  WEBHOOK_HARD_FAILURE_LIMIT,
  WEBHOOK_SIGNATURE_HEADER,
} from "./webhook.ts"

test("parseWebhookUrl accepts Slack Incoming Webhook HTTPS URLs", () => {
  const parsed = parseWebhookUrl(
    "https://hooks.slack.com/services/T000/B000/xxx"
  )
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.url, "https://hooks.slack.com/services/T000/B000/xxx")
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
  assert.equal(isBlockedWebhookHost("hooks.slack.com"), false)
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
  assert.match(payload.text, /Statussy/)
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
  })
  assert.equal(payload.services[1]?.checkedAt, "2026-09-11T18:01:00.000Z")
  assert.equal(payload.services[1]?.officialStatusUrl, null)
})

test("text summary stays short for Slack without Block Kit", () => {
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
      },
    ]),
    "Statussy: OpenAI flipped to Major outage"
  )
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
    url: "https://hooks.slack.com/services/T000/B000/xxx",
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
