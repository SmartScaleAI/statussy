import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyWebhookFailure,
  buildWebhookPayload,
  buildWebhookServices,
  deliverWebhook,
  parseWebhookUrl,
  serializeWebhookPayload,
  signWebhookBody,
  WEBHOOK_HARD_FAILURE_LIMIT,
  WEBHOOK_SIGNATURE_HEADER,
} from "../src/webhook.js"

test("parseWebhookUrl accepts Slack Incoming Webhook HTTPS URLs", () => {
  const parsed = parseWebhookUrl(
    "https://hooks.slack.com/services/T000/B000/xxx"
  )
  assert.equal(parsed.ok, true)
})

test("parseWebhookUrl rejects non-https and loopback", () => {
  assert.equal(parseWebhookUrl("http://example.com/hook").ok, false)
  assert.equal(parseWebhookUrl("https://127.0.0.1/hook").ok, false)
})

test("batched payload includes required service fields and Slack text", () => {
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
    ],
    "https://www.statussy.com",
    "2026-09-11T18:00:00.000Z"
  )
  const payload = buildWebhookPayload(services)
  assert.equal(
    payload.text,
    "Statussy: OpenAI flipped to Major outage"
  )
  assert.equal(payload.services[0]?.serviceId, "openai")
  assert.equal(payload.services[0]?.fromStatus, "operational")
  assert.equal(payload.services[0]?.toStatus, "major_outage")
  assert.equal(payload.services[0]?.officialStatusUrl, "https://status.openai.com/")
  assert.equal(
    payload.services[0]?.statussyUrl,
    "https://www.statussy.com/services/openai"
  )
  const body = serializeWebhookPayload(payload)
  assert.match(body, /"text":/)
  assert.match(body, /"services":\[/)
  assert.doesNotMatch(body, /blocks/)
})

test("signature is HMAC-SHA256 of the posted body", () => {
  const body = serializeWebhookPayload(
    buildWebhookPayload(
      buildWebhookServices(
        [
          {
            serviceId: "openai",
            name: "OpenAI",
            from: "operational",
            to: "major_outage",
          },
        ],
        "https://www.statussy.com",
        "2026-09-11T18:00:00.000Z"
      )
    )
  )
  const header = signWebhookBody("stsy_testsecret", body)
  assert.match(header, /^sha256=[0-9a-f]{64}$/)
})

test("deliverWebhook sends one signed POST and treats 4xx as hard", async () => {
  const calls: RequestInit[] = []
  const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
    calls.push(init ?? {})
    return new Response("no_active_hooks", { status: 404 })
  }) as typeof fetch
  const body = '{"text":"Statussy test","services":[]}'
  const result = await deliverWebhook({
    url: "https://hooks.slack.com/services/T000/B000/xxx",
    secret: "stsy_secret",
    body,
    fetchImpl,
  })
  assert.equal(result.ok, false)
  assert.equal(calls.length, 1)
  const headers = calls[0]?.headers as Record<string, string>
  assert.equal(
    headers[WEBHOOK_SIGNATURE_HEADER],
    signWebhookBody("stsy_secret", body)
  )
})

test("three hard failures disable the webhook", () => {
  const third = applyWebhookFailure(
    applyWebhookFailure(applyWebhookFailure(0).consecutiveFailures)
      .consecutiveFailures
  )
  assert.equal(third.consecutiveFailures, WEBHOOK_HARD_FAILURE_LIMIT)
  assert.equal(third.enabled, false)
  assert.equal(third.disabledReason, "hard_failures")
})
