import assert from "node:assert/strict"
import { test } from "node:test"

import {
  AUTH_HEADER_HINT_ATTR,
  AUTH_HEADER_HINT_KEY,
  AUTH_HEADER_HINT_SCRIPT,
  AUTH_HEADER_HINT_SIGNED_IN,
  AUTH_HEADER_HINT_VALUE,
  parseAuthHeaderHintCookieHeader,
  resolveAuthHeaderChrome,
} from "./auth-header-hint.ts"

test("hint cookie name and value stay stable", () => {
  assert.equal(AUTH_HEADER_HINT_KEY, "statussy:authHint")
  assert.equal(AUTH_HEADER_HINT_VALUE, "1")
  assert.equal(AUTH_HEADER_HINT_ATTR, "data-auth-hint")
  assert.equal(AUTH_HEADER_HINT_SIGNED_IN, "signed-in")
})

test("parseAuthHeaderHintCookieHeader reads statussy:authHint=1", () => {
  assert.equal(parseAuthHeaderHintCookieHeader(null), false)
  assert.equal(parseAuthHeaderHintCookieHeader(""), false)
  assert.equal(parseAuthHeaderHintCookieHeader("theme=dark"), false)
  assert.equal(parseAuthHeaderHintCookieHeader("statussy:authHint=0"), false)
  assert.equal(
    parseAuthHeaderHintCookieHeader("statussy:boardTab=stack"),
    false
  )
  assert.equal(parseAuthHeaderHintCookieHeader("statussy:authHint=1"), true)
  assert.equal(
    parseAuthHeaderHintCookieHeader("theme=dark; statussy:authHint=1"),
    true
  )
  assert.equal(
    parseAuthHeaderHintCookieHeader("statussy:authHint=1; theme=dark"),
    true
  )
})

test("pending session honors the hint; settled session wins", () => {
  assert.equal(
    resolveAuthHeaderChrome({ sessionStatus: "pending", hasHint: true }),
    "signed-in"
  )
  assert.equal(
    resolveAuthHeaderChrome({ sessionStatus: "pending", hasHint: false }),
    "signed-out"
  )
  assert.equal(
    resolveAuthHeaderChrome({ sessionStatus: "signed-in", hasHint: false }),
    "signed-in"
  )
  assert.equal(
    resolveAuthHeaderChrome({ sessionStatus: "signed-out", hasHint: true }),
    "signed-out"
  )
  assert.equal(
    resolveAuthHeaderChrome({ sessionStatus: "signed-out", hasHint: false }),
    "signed-out"
  )
})

test("blocking script encodes the hint cookie and document attribute", () => {
  assert.equal(AUTH_HEADER_HINT_SCRIPT.includes(AUTH_HEADER_HINT_KEY), true)
  assert.equal(AUTH_HEADER_HINT_SCRIPT.includes(AUTH_HEADER_HINT_VALUE), true)
  assert.equal(AUTH_HEADER_HINT_SCRIPT.includes(AUTH_HEADER_HINT_ATTR), true)
  assert.equal(
    AUTH_HEADER_HINT_SCRIPT.includes(AUTH_HEADER_HINT_SIGNED_IN),
    true
  )
  assert.equal(AUTH_HEADER_HINT_SCRIPT.includes("cookies()"), false)
})
