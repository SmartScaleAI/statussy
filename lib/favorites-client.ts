/**
 * Client board favorites (SMA-146).
 *
 * First HTML stays on the shared ISR snapshot (no private My Stack ids).
 * After hydrate, getMyFavorites() can run in parallel with useSession —
 * the server action already reads the session cookie, so waiting for the
 * auth client to settle only adds a waterfall.
 */

export type FavoritesFetchState =
  | { status: "idle" }
  | { status: "done"; signedIn: boolean; favoriteIds: readonly string[] }

export type FavoritesClientInput = {
  authPending: boolean
  authSignedIn: boolean
  fetch: FavoritesFetchState
}

export type FavoritesClientView = {
  signedIn: boolean
  isLoading: boolean
  favoriteIds: readonly string[]
}

/**
 * Stars / My Stack settle as soon as a signed-in favorites payload arrives,
 * even if useSession is still pending. Signed-out waits for auth so a
 * failed getMyFavorites (returns signed-out) cannot flash an empty stack
 * for a signed-in user.
 */
export function resolveFavoritesClientState(
  input: FavoritesClientInput
): FavoritesClientView {
  const { authPending, authSignedIn, fetch } = input

  if (fetch.status === "done" && fetch.signedIn) {
    return {
      signedIn: true,
      isLoading: false,
      favoriteIds: fetch.favoriteIds,
    }
  }

  if (!authPending && !authSignedIn) {
    return {
      signedIn: false,
      isLoading: false,
      favoriteIds: [],
    }
  }

  if (!authPending && authSignedIn && fetch.status === "done") {
    return {
      signedIn: true,
      isLoading: false,
      favoriteIds: fetch.signedIn ? fetch.favoriteIds : [],
    }
  }

  return {
    signedIn: authSignedIn,
    isLoading: true,
    favoriteIds: [],
  }
}

/**
 * Start getMyFavorites without waiting for useSession. Skip a second
 * trip when an in-flight or completed prefetch already covers this
 * signed-in session. Signed-out auth never needs a favorites round-trip.
 * A signed-out payload is retried only after a fresh client sign-in.
 */
export function shouldFetchFavorites(input: {
  authPending: boolean
  authSignedIn: boolean
  fetch: FavoritesFetchState
  justSignedIn?: boolean
}): boolean {
  if (input.fetch.status === "done" && input.fetch.signedIn) {
    return false
  }
  if (!input.authPending && !input.authSignedIn) {
    return false
  }
  if (input.fetch.status === "idle") {
    return true
  }
  return Boolean(input.justSignedIn)
}
