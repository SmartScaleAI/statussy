import assert from "node:assert/strict"
import { test } from "node:test"

import { MAX_EMAIL_LENGTH } from "./suggest-service.ts"
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_SERVICE_LENGTH,
  notifySlackReport,
  parseReportInput,
} from "./user-report.ts"

test("description is required for reports", () => {
  const parsed = parseReportInput({
    kind: "wrong_status",
    description: "  ",
    service: "",
    email: "",
  })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.equal(parsed.fieldErrors.description, "Description is required.")
  }
})

test("kind must be a report type", () => {
  const parsed = parseReportInput({
    kind: "suggest_service",
    description: "OpenAI is green but I saw an outage.",
    service: "OpenAI",
    email: "",
  })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.equal(parsed.fieldErrors.kind, "Choose a report type.")
  }
})

test("optional service and email may be omitted", () => {
  const parsed = parseReportInput({
    kind: "site_bug",
    description: "Sort menu overlaps the search field.",
    service: "",
    email: "",
  })
  assert.deepEqual(parsed, {
    ok: true,
    kind: "site_bug",
    description: "Sort menu overlaps the search field.",
    service: null,
    email: null,
  })
})

test("service and email are accepted together", () => {
  const parsed = parseReportInput({
    kind: "wrong_info",
    description: "Logo is the old mark.",
    service: "Anthropic",
    email: "colin@example.com",
  })
  assert.deepEqual(parsed, {
    ok: true,
    kind: "wrong_info",
    description: "Logo is the old mark.",
    service: "Anthropic",
    email: "colin@example.com",
  })
})

test("rejects an obviously invalid email", () => {
  const parsed = parseReportInput({
    kind: "other",
    description: "Something else",
    service: "",
    email: "not-an-email",
  })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.equal(
      parsed.fieldErrors.email,
      "Enter a valid email, or leave it blank."
    )
  }
})

test("rejects an overlong description", () => {
  const parsed = parseReportInput({
    kind: "wrong_status",
    description: "x".repeat(MAX_DESCRIPTION_LENGTH + 1),
    service: "",
    email: "",
  })
  assert.equal(parsed.ok, false)
})

test("rejects an overlong service", () => {
  const parsed = parseReportInput({
    kind: "wrong_status",
    description: "Status looks stale.",
    service: "x".repeat(MAX_SERVICE_LENGTH + 1),
    email: "",
  })
  assert.equal(parsed.ok, false)
})

test("rejects an overlong email", () => {
  const parsed = parseReportInput({
    kind: "other",
    description: "Note",
    service: "",
    email: `${"a".repeat(MAX_EMAIL_LENGTH)}@x.co`,
  })
  assert.equal(parsed.ok, false)
})

test("missing Slack webhook skips notify and does not throw", async () => {
  const warnings: unknown[][] = []
  const result = await notifySlackReport(
    {
      kind: "wrong_status",
      description: "OpenAI shows operational",
      service: "OpenAI",
      email: null,
      userId: null,
      createdAt: new Date(),
    },
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
  const result = await notifySlackReport(
    {
      kind: "site_bug",
      description: "Broken",
      service: null,
      email: "a@b.co",
      userId: "user_1",
      createdAt: "not-a-date",
    },
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
  const result = await notifySlackReport(
    {
      kind: "other",
      description: "Hello",
      service: null,
      email: null,
      userId: null,
      createdAt: new Date(),
    },
    {
      webhookUrl: "https://hooks.slack.com/services/test",
      fetchImpl: async () =>
        new Response("no_service", { status: 404, statusText: "Not Found" }),
      log: { warn: () => {}, error: () => {} },
    }
  )
  assert.equal(result, "failed")
})

test("Slack 200 includes type, description, and optional fields", async () => {
  let body = ""
  const result = await notifySlackReport(
    {
      kind: "wrong_status",
      description: "Card is green during an incident.",
      service: "OpenAI",
      email: "colin@example.com",
      userId: "user_42",
      createdAt: new Date("2026-09-10T21:00:00.000Z"),
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
  assert.match(body, /New user report/)
  assert.match(body, /Wrong status/)
  assert.match(body, /Card is green during an incident/)
  assert.match(body, /OpenAI/)
  assert.match(body, /colin@example.com/)
  assert.match(body, /user_42/)
})
