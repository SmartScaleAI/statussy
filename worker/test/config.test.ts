import assert from "node:assert/strict"
import { test } from "node:test"

import {
  DEFAULT_RESEND_FROM,
  loadConfig,
  resolveDigestFrom,
} from "../src/config.js"

const DB = { DATABASE_URL: "postgres://localhost/statussy" }

test("DEFAULT_RESEND_FROM is Statussy at noreply@statussy.com", () => {
  assert.equal(DEFAULT_RESEND_FROM, "Statussy <noreply@statussy.com>")
})

test("resolveDigestFrom defaults empty and replaces smartaiscaling.com", () => {
  assert.equal(resolveDigestFrom(undefined), DEFAULT_RESEND_FROM)
  assert.equal(resolveDigestFrom("  "), DEFAULT_RESEND_FROM)
  assert.equal(
    resolveDigestFrom("noreply@smartaiscaling.com"),
    DEFAULT_RESEND_FROM
  )
  assert.equal(
    resolveDigestFrom("Statussy <noreply@smartaiscaling.com>"),
    DEFAULT_RESEND_FROM
  )
})

test("resolveDigestFrom adds Statussy display name to a bare address", () => {
  assert.equal(
    resolveDigestFrom("noreply@statussy.com"),
    "Statussy <noreply@statussy.com>"
  )
})

test("resolveDigestFrom keeps an explicit Statussy from", () => {
  assert.equal(
    resolveDigestFrom("Statussy <noreply@statussy.com>"),
    "Statussy <noreply@statussy.com>"
  )
})

test("loadConfig uses the Statussy default when RESEND_FROM is unset", () => {
  const config = loadConfig({
    ...DB,
    RESEND_API_KEY: "re_test",
  })
  assert.deepEqual(config.resend, {
    apiKey: "re_test",
    from: DEFAULT_RESEND_FROM,
  })
})

test("loadConfig never keeps smartaiscaling.com as digest From", () => {
  const config = loadConfig({
    ...DB,
    RESEND_API_KEY: "re_test",
    RESEND_FROM: "noreply@smartaiscaling.com",
  })
  assert.equal(config.resend?.from, DEFAULT_RESEND_FROM)
  assert.doesNotMatch(config.resend?.from ?? "", /smartaiscaling/)
})

test("loadConfig skips Resend when the API key is missing", () => {
  const config = loadConfig({
    ...DB,
    RESEND_FROM: "Statussy <noreply@statussy.com>",
  })
  assert.equal(config.resend, null)
})
