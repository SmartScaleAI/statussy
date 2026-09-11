import assert from "node:assert/strict"
import { test } from "node:test"

import {
  SITE_DESCRIPTION,
  SITE_OG_LINE,
  SITE_TITLE,
  SITE_URL,
} from "./site-metadata.ts"

const locked = `${SITE_TITLE}\n${SITE_DESCRIPTION}\n${SITE_OG_LINE}`

test("locked whole-stack preview copy", () => {
  assert.equal(SITE_URL, "https://www.statussy.com")
  assert.equal(SITE_TITLE, "Statussy | Live status for the tools you use")
  assert.equal(
    SITE_DESCRIPTION,
    "Free status board for your stack. Star favorites in My Stack and see what\u2019s down in one place."
  )
  assert.equal(SITE_OG_LINE, "Your stack. Live status.")
})

test("preview copy is not AI-down and has no em or en dashes", () => {
  assert.equal(/AI is down/i.test(locked), false)
  assert.equal(locked.includes("\u2014"), false)
  assert.equal(locked.includes("\u2013"), false)
})
