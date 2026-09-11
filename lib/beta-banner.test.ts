import assert from "node:assert/strict"
import { test } from "node:test"

import { BETA_BANNER_COPY, shouldShowBetaBanner } from "./beta-banner.ts"

test("locked copy has no em dash or en dash punctuation", () => {
  assert.equal(
    BETA_BANNER_COPY,
    "Statussy is in beta. Statuses can be wrong or delayed. Report issues in the side panel."
  )
  assert.equal(BETA_BANNER_COPY.includes("\u2014"), false)
  assert.equal(BETA_BANNER_COPY.includes("\u2013"), false)
})

test("banner shows once storage is ready and not dismissed", () => {
  assert.equal(
    shouldShowBetaBanner({ storageReady: true, dismissed: false }),
    true
  )
})

test("banner hides until storage is ready", () => {
  assert.equal(
    shouldShowBetaBanner({ storageReady: false, dismissed: false }),
    false
  )
})

test("dismissed banner stays hidden", () => {
  assert.equal(
    shouldShowBetaBanner({ storageReady: true, dismissed: true }),
    false
  )
})
