import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseBetterAuthSessionUserId,
  parseUserId,
  readBetterAuthSessionToken,
  resolveAuthBaseUrl,
} from "./auth-session.ts"

test("parseUserId trims and rejects blanks or overlong ids", () => {
  assert.equal(parseUserId("  user_abc  "), "user_abc")
  assert.equal(parseUserId(""), null)
  assert.equal(parseUserId("   "), null)
  assert.equal(parseUserId(1), null)
  assert.equal(parseUserId("x".repeat(129)), null)
})

test("readBetterAuthSessionToken prefers the Secure cookie", () => {
  assert.equal(readBetterAuthSessionToken(null), null)
  assert.equal(readBetterAuthSessionToken("theme=dark"), null)
  assert.equal(
    readBetterAuthSessionToken("better-auth.session_token=tok_plain"),
    "tok_plain"
  )
  assert.equal(
    readBetterAuthSessionToken(
      "better-auth.session_token=tok_plain; __Secure-better-auth.session_token=tok_secure"
    ),
    "tok_secure"
  )
  assert.equal(
    readBetterAuthSessionToken("better-auth.session_token=tok%2Bplus"),
    "tok+plus"
  )
})

test("resolveAuthBaseUrl prefers BETTER_AUTH_URL then forwarded host", () => {
  const headers = new Headers({
    host: "statussy.com",
    "x-forwarded-proto": "https",
  })
  assert.equal(
    resolveAuthBaseUrl(headers, { BETTER_AUTH_URL: "https://auth.example/" }),
    "https://auth.example"
  )
  assert.equal(resolveAuthBaseUrl(headers, {}), "https://statussy.com")
  assert.equal(
    resolveAuthBaseUrl(
      new Headers({
        "x-forwarded-host": "www.statussy.com",
        "x-forwarded-proto": "https",
      }),
      {}
    ),
    "https://www.statussy.com"
  )
  assert.equal(
    resolveAuthBaseUrl(new Headers({ host: "localhost:3000" }), {}),
    "http://localhost:3000"
  )
})

test("parseBetterAuthSessionUserId reads user.id from get-session shapes", () => {
  assert.equal(parseBetterAuthSessionUserId(null), null)
  assert.equal(parseBetterAuthSessionUserId({}), null)
  assert.equal(parseBetterAuthSessionUserId({ user: { id: "usr_1" } }), "usr_1")
  assert.equal(
    parseBetterAuthSessionUserId({ data: { user: { id: "usr_2" } } }),
    "usr_2"
  )
})
