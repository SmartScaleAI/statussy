import assert from "node:assert/strict"
import { test } from "node:test"

import { shouldRenderAccountSettings } from "./settings-session.ts"

test("hides account settings while the client session is pending", () => {
  assert.equal(
    shouldRenderAccountSettings({ isPending: true, hasUser: true }),
    false
  )
  assert.equal(
    shouldRenderAccountSettings({ isPending: true, hasUser: false }),
    false
  )
})

test("hides account settings when signed out", () => {
  assert.equal(
    shouldRenderAccountSettings({ isPending: false, hasUser: false }),
    false
  )
})

test("shows account settings only for a settled signed-in session", () => {
  assert.equal(
    shouldRenderAccountSettings({ isPending: false, hasUser: true }),
    true
  )
})
