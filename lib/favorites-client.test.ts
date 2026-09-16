import assert from "node:assert/strict"
import { test } from "node:test"

import {
  resolveFavoritesClientState,
  shouldFetchFavorites,
  type FavoritesFetchState,
} from "./favorites-client.ts"

const idle: FavoritesFetchState = { status: "idle" }
const signedOut: FavoritesFetchState = {
  status: "done",
  signedIn: false,
  favoriteIds: [],
}
const signedInStack: FavoritesFetchState = {
  status: "done",
  signedIn: true,
  favoriteIds: ["openai", "anthropic"],
}

test("signed-in favorites apply before auth settles (no waterfall)", () => {
  assert.deepEqual(
    resolveFavoritesClientState({
      authPending: true,
      authSignedIn: false,
      fetch: signedInStack,
    }),
    {
      signedIn: true,
      isLoading: false,
      favoriteIds: ["openai", "anthropic"],
    }
  )
})

test("signed-out does not apply an empty stack while auth is still pending", () => {
  assert.deepEqual(
    resolveFavoritesClientState({
      authPending: true,
      authSignedIn: false,
      fetch: signedOut,
    }),
    {
      signedIn: false,
      isLoading: true,
      favoriteIds: [],
    }
  )
})

test("auth signed-out settles empty without waiting on favorites", () => {
  assert.deepEqual(
    resolveFavoritesClientState({
      authPending: false,
      authSignedIn: false,
      fetch: idle,
    }),
    {
      signedIn: false,
      isLoading: false,
      favoriteIds: [],
    }
  )
})

test("auth signed-in waits until favorites return", () => {
  assert.deepEqual(
    resolveFavoritesClientState({
      authPending: false,
      authSignedIn: true,
      fetch: idle,
    }),
    {
      signedIn: true,
      isLoading: true,
      favoriteIds: [],
    }
  )
})

test("auth signed-in with a signed-out fetch result is an empty stack", () => {
  assert.deepEqual(
    resolveFavoritesClientState({
      authPending: false,
      authSignedIn: true,
      fetch: signedOut,
    }),
    {
      signedIn: true,
      isLoading: false,
      favoriteIds: [],
    }
  )
})

test("shouldFetchFavorites starts immediately while auth is pending", () => {
  assert.equal(
    shouldFetchFavorites({
      authPending: true,
      authSignedIn: false,
      fetch: idle,
    }),
    true
  )
})

test("shouldFetchFavorites skips a second trip after a signed-in payload", () => {
  assert.equal(
    shouldFetchFavorites({
      authPending: false,
      authSignedIn: true,
      fetch: signedInStack,
    }),
    false
  )
  assert.equal(
    shouldFetchFavorites({
      authPending: true,
      authSignedIn: false,
      fetch: signedInStack,
    }),
    false
  )
})

test("shouldFetchFavorites does not fetch once auth is signed-out", () => {
  assert.equal(
    shouldFetchFavorites({
      authPending: false,
      authSignedIn: false,
      fetch: idle,
    }),
    false
  )
})

test("shouldFetchFavorites refetches only after a fresh sign-in", () => {
  assert.equal(
    shouldFetchFavorites({
      authPending: false,
      authSignedIn: true,
      fetch: signedOut,
    }),
    false
  )
  assert.equal(
    shouldFetchFavorites({
      authPending: false,
      authSignedIn: true,
      fetch: signedOut,
      justSignedIn: true,
    }),
    true
  )
})
