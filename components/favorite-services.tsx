"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { getMyFavorites, toggleMyFavorite } from "@/app/actions/favorites"
import { useAuth } from "@/components/auth-provider"
import {
  resolveFavoritesClientState,
  shouldFetchFavorites,
  type FavoritesFetchState,
} from "@/lib/favorites-client"
import { toggleFavoriteServiceId } from "@/lib/favorite-services"

type FavoriteServicesContextValue = {
  signedIn: boolean
  /** True until stars / My Stack can render; signed-in favorites may settle before useSession. */
  isLoading: boolean
  favoriteIds: readonly string[]
  isFavorited: (id: string) => boolean
  toggleFavorite: (id: string) => void
}

const FavoriteServicesContext =
  createContext<FavoriteServicesContextValue | null>(null)

/**
 * One in-flight getMyFavorites for this tab. Board + detail providers
 * share it so auth settling does not start a second round-trip (SMA-146).
 */
let inflightFavorites: Promise<{
  signedIn: boolean
  favoriteIds: string[]
}> | null = null

function loadMyFavorites(force = false) {
  if (force) {
    inflightFavorites = null
  }
  if (!inflightFavorites) {
    inflightFavorites = getMyFavorites()
  }
  return inflightFavorites
}

function rememberMyFavorites(result: {
  signedIn: boolean
  favoriteIds: string[]
}) {
  inflightFavorites = Promise.resolve(result)
}

function invalidateMyFavoritesCache() {
  inflightFavorites = null
}

export function FavoriteServicesProvider({
  children,
}: {
  children: ReactNode
}) {
  const { isPending, isSignedIn } = useAuth()
  const [favoritesFetch, setFavoritesFetch] = useState<FavoritesFetchState>({
    status: "idle",
  })
  const wasSignedIn = useRef(false)
  const justSignedIn = !isPending && isSignedIn && !wasSignedIn.current
  const wantsFavorites = shouldFetchFavorites({
    authPending: isPending,
    authSignedIn: isSignedIn,
    fetch: favoritesFetch,
    justSignedIn,
  })
  // Reuse an in-flight first read. Force only after a completed
  // signed-out payload on a fresh sign-in — not while the first
  // request is still open.
  const forceFavorites =
    justSignedIn &&
    favoritesFetch.status === "done" &&
    !favoritesFetch.signedIn

  // SMA-146: start getMyFavorites during the first client render so it
  // overlaps useSession. The action reads the session cookie itself —
  // waiting for isPending only added a waterfall. ISR HTML still has
  // no private stack ids.
  if (typeof window !== "undefined" && wantsFavorites) {
    void loadMyFavorites(forceFavorites)
  }

  useEffect(() => {
    if (!isPending) {
      wasSignedIn.current = isSignedIn
    }
    if (!isPending && !isSignedIn) {
      invalidateMyFavoritesCache()
      if (favoritesFetch.status !== "idle") {
        setFavoritesFetch({ status: "idle" })
      }
      return
    }

    if (!wantsFavorites) {
      return
    }

    let cancelled = false
    void loadMyFavorites(forceFavorites).then((result) => {
      if (cancelled) {
        return
      }
      setFavoritesFetch({
        status: "done",
        signedIn: result.signedIn,
        favoriteIds: result.signedIn ? result.favoriteIds : [],
      })
    })
    return () => {
      cancelled = true
    }
  }, [
    favoritesFetch.status,
    forceFavorites,
    isPending,
    isSignedIn,
    wantsFavorites,
  ])

  const toggleFavorite = useCallback(
    (id: string) => {
      // Signed-out star clicks are owned by SMA-103 (login dialog).
      if (!isSignedIn) {
        return
      }
      setFavoritesFetch((prev) => {
        const currentIds =
          prev.status === "done" && prev.signedIn ? [...prev.favoriteIds] : []
        const nextIds = toggleFavoriteServiceId(currentIds, id)
        const optimistic = {
          status: "done" as const,
          signedIn: true,
          favoriteIds: nextIds,
        }
        void toggleMyFavorite(id).then((result) => {
          if (result.signedIn) {
            rememberMyFavorites(result)
            setFavoritesFetch({
              status: "done",
              signedIn: true,
              favoriteIds: result.favoriteIds,
            })
          } else {
            setFavoritesFetch(
              prev.status === "done"
                ? prev
                : { status: "done", signedIn: false, favoriteIds: [] }
            )
          }
        })
        return optimistic
      })
    },
    [isSignedIn]
  )

  const view = resolveFavoritesClientState({
    authPending: isPending,
    authSignedIn: isSignedIn,
    fetch: favoritesFetch,
  })

  const value = useMemo<FavoriteServicesContextValue>(
    () => ({
      signedIn: view.signedIn,
      isLoading: view.isLoading,
      favoriteIds: view.favoriteIds,
      isFavorited: (itemId) => view.favoriteIds.includes(itemId),
      toggleFavorite,
    }),
    [toggleFavorite, view.favoriteIds, view.isLoading, view.signedIn]
  )

  return (
    <FavoriteServicesContext.Provider value={value}>
      {children}
    </FavoriteServicesContext.Provider>
  )
}

export function useFavoriteServices() {
  const context = useContext(FavoriteServicesContext)
  if (!context) {
    throw new Error(
      "useFavoriteServices must be used within FavoriteServicesProvider"
    )
  }
  return context
}
