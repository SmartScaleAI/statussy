import assert from "node:assert/strict"
import { test } from "node:test"

import {
  ALERTS_BANNER_BODY,
  ALERTS_BANNER_CTA,
  ALERTS_BANNER_HASH_ID,
  ALERTS_BANNER_HREF,
  applyDigestPrefsPatch,
  DEFAULT_DIGEST_PREFS,
  DIGEST_BANNER_DISMISS_KEY,
  OPT_IN_DIGEST_PREFS,
  shouldShowDigestBanner,
} from "./digest-banner.ts"

const signedOut = {
  authPending: false,
  signedIn: false,
  emailEnabled: false,
  prefsReady: false,
  localDismissed: false,
  storageReady: true,
}

const signedIn = {
  authPending: false,
  signedIn: true,
  emailEnabled: false,
  prefsReady: true,
  localDismissed: false,
  storageReady: true,
}

test("locked copy has no em dash or en dash punctuation", () => {
  assert.equal(
    ALERTS_BANNER_BODY,
    "Get alerts when tools in My Stack go down. Email or webhook."
  )
  assert.equal(ALERTS_BANNER_CTA, "Set up alerts")
  assert.equal(ALERTS_BANNER_BODY.includes("\u2014"), false)
  assert.equal(ALERTS_BANNER_BODY.includes("\u2013"), false)
  assert.equal(ALERTS_BANNER_CTA.includes("\u2014"), false)
  assert.equal(ALERTS_BANNER_CTA.includes("\u2013"), false)
})

test("locked copy is email or webhook, not Slack-only", () => {
  assert.match(ALERTS_BANNER_BODY, /Email or webhook/)
  assert.equal(/slack/i.test(ALERTS_BANNER_BODY), false)
  assert.equal(/slack/i.test(ALERTS_BANNER_CTA), false)
})

test("CTA deep-links to Settings alerts", () => {
  assert.equal(ALERTS_BANNER_HASH_ID, "alerts")
  assert.equal(ALERTS_BANNER_HREF, "/settings#alerts")
})

test("dismiss key is bumped off the email-only banner key", () => {
  assert.notEqual(
    DIGEST_BANNER_DISMISS_KEY,
    "statussy.email-alerts-banner-dismissed"
  )
  assert.equal(DIGEST_BANNER_DISMISS_KEY, "statussy.alerts-banner-dismissed")
})

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

test("signed-in banner hides when opted in, locally dismissed, or prefs pending", () => {
  assert.equal(
    shouldShowDigestBanner({ ...signedIn, emailEnabled: true }),
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
