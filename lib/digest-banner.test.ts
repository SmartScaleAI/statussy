import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyDigestPrefsPatch,
  DEFAULT_DIGEST_PREFS,
  OPT_IN_DIGEST_PREFS,
  shouldShowDigestBanner,
} from "./digest-banner.ts"

const signedOut = {
  authPending: false,
  signedIn: false,
  emailEnabled: false,
  bannerDismissed: false,
  prefsReady: false,
  localDismissed: false,
  storageReady: true,
}

const signedIn = {
  authPending: false,
  signedIn: true,
  emailEnabled: false,
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
    shouldShowDigestBanner({ ...signedIn, emailEnabled: true }),
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

test("banner Enable applies Major on / Partial off and does not enable Partial", () => {
  const next = applyDigestPrefsPatch(DEFAULT_DIGEST_PREFS, {
    emailEnabled: true,
  })
  assert.deepEqual(next, OPT_IN_DIGEST_PREFS)
  assert.equal(next.notifyPartial, false)
})

test("settings notify-on marks master opted-in without flipping the other toggle", () => {
  const majorOn = applyDigestPrefsPatch(DEFAULT_DIGEST_PREFS, {
    notifyMajor: true,
  })
  assert.equal(majorOn.emailEnabled, true)
  assert.equal(majorOn.notifyMajor, true)
  assert.equal(majorOn.notifyPartial, false)
  assert.equal(majorOn.bannerDismissed, true)

  const optedIn = applyDigestPrefsPatch(OPT_IN_DIGEST_PREFS, {
    notifyPartial: true,
  })
  assert.equal(optedIn.notifyMajor, true)
  assert.equal(optedIn.notifyPartial, true)

  const majorOff = applyDigestPrefsPatch(OPT_IN_DIGEST_PREFS, {
    notifyMajor: false,
  })
  assert.equal(majorOff.emailEnabled, true)
  assert.equal(majorOff.notifyMajor, false)
  assert.equal(majorOff.notifyPartial, false)
})
