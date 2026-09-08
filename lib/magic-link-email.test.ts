import assert from "node:assert/strict"
import { test } from "node:test"

import {
  publicAuthFailureMessage,
  resendConfigErrorMessage,
  resendDeliveryErrorMessage,
  resolveResendConfig,
} from "./magic-link-email.ts"

test("resolveResendConfig requires both key and from", () => {
  assert.deepEqual(resolveResendConfig({}), {
    ok: false,
    missing: ["RESEND_API_KEY", "RESEND_FROM"],
  })
  assert.deepEqual(resolveResendConfig({ RESEND_API_KEY: "re_test" }), {
    ok: false,
    missing: ["RESEND_FROM"],
  })
  assert.deepEqual(resolveResendConfig({ RESEND_FROM: "Statussy <a@b.com>" }), {
    ok: false,
    missing: ["RESEND_API_KEY"],
  })
})

test("resolveResendConfig accepts RESEND_FROM_EMAIL as an alias", () => {
  assert.deepEqual(
    resolveResendConfig({
      RESEND_API_KEY: "re_test",
      RESEND_FROM_EMAIL: "Statussy <noreply@statussy.com>",
    }),
    {
      ok: true,
      apiKey: "re_test",
      from: "Statussy <noreply@statussy.com>",
    }
  )
})

test("resolveResendConfig prefers RESEND_FROM over the alias", () => {
  assert.deepEqual(
    resolveResendConfig({
      RESEND_API_KEY: " re_test ",
      RESEND_FROM: " Statussy <noreply@statussy.com> ",
      RESEND_FROM_EMAIL: "ignored@example.com",
    }),
    {
      ok: true,
      apiKey: "re_test",
      from: "Statussy <noreply@statussy.com>",
    }
  )
})

test("resendConfigErrorMessage names the missing vars", () => {
  assert.equal(
    resendConfigErrorMessage(["RESEND_API_KEY", "RESEND_FROM"]),
    "Email sign-in is not configured. Set RESEND_API_KEY and RESEND_FROM on Vercel Production."
  )
})

test("resendDeliveryErrorMessage flags unverified domains", () => {
  assert.match(
    resendDeliveryErrorMessage("The statussy.com domain is not verified"),
    /Verify the RESEND_FROM domain/
  )
})

test("publicAuthFailureMessage keeps actionable copy", () => {
  assert.equal(
    publicAuthFailureMessage(
      new Error(
        "Email sign-in is not configured. Set RESEND_API_KEY on Vercel Production."
      )
    ),
    "Email sign-in is not configured. Set RESEND_API_KEY on Vercel Production."
  )
  assert.equal(
    publicAuthFailureMessage(new Error("secret pg connection string")),
    "Could not send a sign-in link. Check Vercel function logs."
  )
})
