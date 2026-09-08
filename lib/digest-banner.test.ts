import assert from "node:assert/strict"
import { test } from "node:test"

import { shouldShowDigestBanner } from "./digest-banner.ts"

const ready = {
  signedIn: true,
  favoriteCount: 1,
  emailMajorPartial: false,
  bannerDismissed: false,
  prefsReady: true,
  favoritesReady: true,
}

test("banner shows after the first favorite when prefs are off and not dismissed", () => {
  assert.equal(shouldShowDigestBanner(ready), true)
})

test("banner hides when signed out, empty stack, opted in, or dismissed", () => {
  assert.equal(shouldShowDigestBanner({ ...ready, signedIn: false }), false)
  assert.equal(shouldShowDigestBanner({ ...ready, favoriteCount: 0 }), false)
  assert.equal(
    shouldShowDigestBanner({ ...ready, emailMajorPartial: true }),
    false
  )
  assert.equal(
    shouldShowDigestBanner({ ...ready, bannerDismissed: true }),
    false
  )
})

test("banner waits until favorites and prefs have settled", () => {
  assert.equal(shouldShowDigestBanner({ ...ready, prefsReady: false }), false)
  assert.equal(
    shouldShowDigestBanner({ ...ready, favoritesReady: false }),
    false
  )
})
