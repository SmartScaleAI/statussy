import assert from "node:assert/strict"
import { test } from "node:test"

import {
  canUnlinkSocialProvider,
  connectedSocialProviders,
  emailAvatarLetter,
  isSocialProvider,
} from "./sign-in-methods.ts"

test("emailAvatarLetter uses the first email character", () => {
  assert.equal(emailAvatarLetter("colin@statussy.com"), "C")
  assert.equal(emailAvatarLetter("  magic@example.com"), "M")
  assert.equal(emailAvatarLetter(""), "?")
})

test("isSocialProvider accepts google and github only", () => {
  assert.equal(isSocialProvider("google"), true)
  assert.equal(isSocialProvider("github"), true)
  assert.equal(isSocialProvider("magic-link"), false)
  assert.equal(isSocialProvider("credential"), false)
})

test("connectedSocialProviders ignores non-OAuth rows", () => {
  const connected = connectedSocialProviders([
    { providerId: "google" },
    { providerId: "magic-link" },
    { providerId: "github" },
  ])
  assert.deepEqual([...connected].sort(), ["github", "google"])
})

test("cannot unlink the last OAuth method", () => {
  assert.equal(
    canUnlinkSocialProvider([{ providerId: "google" }], "google"),
    false
  )
  assert.equal(
    canUnlinkSocialProvider([{ providerId: "github" }], "github"),
    false
  )
  assert.equal(canUnlinkSocialProvider([], "google"), false)
})

test("can unlink when another OAuth provider remains", () => {
  const linked = [{ providerId: "google" }, { providerId: "github" }]
  assert.equal(canUnlinkSocialProvider(linked, "google"), true)
  assert.equal(canUnlinkSocialProvider(linked, "github"), true)
})
