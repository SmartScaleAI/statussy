import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MAX_NAME_LENGTH,
  formatSuggestionIso,
  notifySlackSuggestion,
  parseSuggestionInput,
  toSuggestionTimestamp,
} from "./suggest-service.ts"

test("name is required", () => {
  const parsed = parseSuggestionInput({ name: "  ", email: "" })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.equal(parsed.fieldErrors.name, "Service name is required.")
  }
})

test("optional email may be omitted", () => {
  const parsed = parseSuggestionInput({ name: "Groq", email: "" })
  assert.deepEqual(parsed, { ok: true, name: "Groq", email: null })
})

test("name and email are accepted together", () => {
  const parsed = parseSuggestionInput({
    name: "Groq",
    email: "colin@example.com",
  })
  assert.deepEqual(parsed, {
    ok: true,
    name: "Groq",
    email: "colin@example.com",
  })
})

test("rejects an obviously invalid email", () => {
  const parsed = parseSuggestionInput({ name: "Groq", email: "not-an-email" })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.equal(
      parsed.fieldErrors.email,
      "Enter a valid email, or leave it blank."
    )
  }
})

test("rejects an overlong name", () => {
  const parsed = parseSuggestionInput({
    name: "x".repeat(MAX_NAME_LENGTH + 1),
    email: "",
  })
  assert.equal(parsed.ok, false)
})

test("toSuggestionTimestamp accepts Date, ISO string, and falls back", () => {
  const date = new Date("2026-09-04T21:00:00.000Z")
  assert.equal(toSuggestionTimestamp(date).toISOString(), date.toISOString())
  assert.equal(
    toSuggestionTimestamp("2026-09-04T21:00:00.000Z").toISOString(),
    date.toISOString()
  )
  const fallback = new Date("2026-01-01T00:00:00.000Z")
  assert.equal(
    toSuggestionTimestamp("not a date", () => fallback).toISOString(),
    fallback.toISOString()
  )
})

test("formatSuggestionIso never throws on junk", () => {
  assert.match(formatSuggestionIso(undefined), /^\d{4}-/)
  assert.match(formatSuggestionIso({}), /^\d{4}-/)
})

test("missing Slack webhook skips notify and does not throw", async () => {
  const warnings: unknown[][] = []
  const result = await notifySlackSuggestion(
    { name: "Groq", email: null, createdAt: new Date() },
    {
      webhookUrl: null,
      log: {
        warn: (...args: unknown[]) => {
          warnings.push(args)
        },
        error: () => {
          throw new Error("error should not be called")
        },
      },
    }
  )
  assert.equal(result, "skipped")
  assert.equal(warnings.length, 1)
})

test("Slack fetch failure is failed, not thrown", async () => {
  const result = await notifySlackSuggestion(
    { name: "Groq", email: "a@b.co", createdAt: "not-a-date" },
    {
      webhookUrl: "https://hooks.slack.com/services/test",
      fetchImpl: async () => {
        throw new Error("network down")
      },
      log: { warn: () => {}, error: () => {} },
    }
  )
  assert.equal(result, "failed")
})

test("Slack HTTP error is failed, not thrown", async () => {
  const result = await notifySlackSuggestion(
    { name: "Groq", email: null, createdAt: new Date() },
    {
      webhookUrl: "https://hooks.slack.com/services/test",
      fetchImpl: async () =>
        new Response("no_service", { status: 404, statusText: "Not Found" }),
      log: { warn: () => {}, error: () => {} },
    }
  )
  assert.equal(result, "failed")
})

test("Slack 200 is sent", async () => {
  let body = ""
  const result = await notifySlackSuggestion(
    {
      name: "Groq",
      email: "colin@example.com",
      createdAt: new Date("2026-09-04T21:00:00.000Z"),
    },
    {
      webhookUrl: "https://hooks.slack.com/services/test",
      fetchImpl: async (_url, init) => {
        body = String(init?.body ?? "")
        return new Response("ok", { status: 200 })
      },
      log: { warn: () => {}, error: () => {} },
    }
  )
  assert.equal(result, "sent")
  assert.match(body, /New service suggestion/)
  assert.match(body, /Groq/)
  assert.match(body, /colin@example.com/)
})
