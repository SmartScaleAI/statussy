import assert from "node:assert/strict"
import { test } from "node:test"

import { shouldShowDigestBanner } from "./digest-banner.ts"

const signedOut = {
  authPending: false,
  signedIn: false,
  emailMajorPartial: false,
  bannerDismissed: false,
  prefsReady: false,
  localDismissed: false,
  storageReady: true,
}

const signedIn = {
  authPending: false,
  signedIn: true,
  emailMajorPartial: false,
  bannerDismissed: false,
  prefsReady: true,
  localDismissed: false,
  storageReady: true,
}

test("signed-out banner shows once storage is ready and not dismissed", () => {
  assert.equal(shouldShowDigestBanner(signedOut), true)
  assert.equal(
    shouldShowDigestBanner({ ...signedOut, storageReady: false }),
    false
  )
  assert.equal(
    shouldShowDigestBanner({ ...signedOut, localDismissed: true }),
    false
  )
})

test("signed-in banner shows when prefs are off and not dismissed", () => {
  assert.equal(shouldShowDigestBanner(signedIn), true)
})

test("signed-in banner is not gated on favorites", () => {
  // Visibility does not take a favorite count — empty stack still sees it.
  assert.equal(shouldShowDigestBanner(signedIn), true)
})

test("signed-in banner hides when opted in, dismissed, or prefs pending", () => {
  assert.equal(
    shouldShowDigestBanner({ ...signedIn, emailMajorPartial: true }),
    false
  )
  assert.equal(
    shouldShowDigestBanner({ ...signedIn, bannerDismissed: true }),
    false
  )
  assert.equal(
    shouldShowDigestBanner({ ...signedIn, localDismissed: true }),
    false
  )
  assert.equal(
    shouldShowDigestBanner({ ...signedIn, prefsReady: false }),
    false
  )
})

test("banner waits until auth has settled", () => {
  assert.equal(
    shouldShowDigestBanner({ ...signedOut, authPending: true }),
    false
  )
  assert.equal(
    shouldShowDigestBanner({ ...signedIn, authPending: true }),
    false
  )
})
