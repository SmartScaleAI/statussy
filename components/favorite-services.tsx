"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { getMyFavorites, toggleMyFavorite } from "@/app/actions/favorites"
import { useAuth } from "@/components/auth-provider"
import { toggleFavoriteServiceId } from "@/lib/favorite-services"

type FavoriteServicesContextValue = {
  signedIn: boolean
  /** True until auth is known and, if signed in, favorites have settled. */
  isLoading: boolean
  favoriteIds: readonly string[]
  isFavorited: (id: string) => boolean
  toggleFavorite: (id: string) => void
}

const FavoriteServicesContext =
  createContext<FavoriteServicesContextValue | null>(null)

export function FavoriteServicesProvider({
  children,
}: {
  children: ReactNode
}) {
  const { isPending, isSignedIn } = useAuth()
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  // SMA-111: empty ids before the first fetch must not count as an empty stack.
  const [favoritesSettled, setFavoritesSettled] = useState(false)

  useEffect(() => {
    if (isPending) {
      return
    }
    if (!isSignedIn) {
      setFavoriteIds([])
      setFavoritesSettled(true)
      return
    }
    setFavoritesSettled(false)
    let cancelled = false
    void getMyFavorites()
      .then((result) => {
        if (cancelled) {
          return
        }
        setFavoriteIds(result.signedIn ? result.favoriteIds : [])
      })
      .finally(() => {
        if (!cancelled) {
          setFavoritesSettled(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isPending, isSignedIn])

  const toggleFavorite = useCallback(
    (id: string) => {
      // Signed-out star clicks are owned by SMA-103 (login dialog).
      if (!isSignedIn) {
        return
      }
      setFavoriteIds((prev) => {
        const next = toggleFavoriteServiceId(prev, id)
        void toggleMyFavorite(id).then((result) => {
          if (result.signedIn) {
            setFavoriteIds(result.favoriteIds)
          } else {
            setFavoriteIds(prev)
          }
        })
        return next
      })
    },
    [isSignedIn]
  )

  // Session refetch can set isPending again; don't swap a loaded stack
  // back to the loader. Signed-out stays empty once auth has settled.
  const isLoading = !favoritesSettled && (isPending || isSignedIn)

  const value = useMemo<FavoriteServicesContextValue>(
    () => ({
      signedIn: isSignedIn,
      isLoading,
      favoriteIds,
      isFavorited: (itemId) => favoriteIds.includes(itemId),
      toggleFavorite,
    }),
    [favoriteIds, isLoading, isSignedIn, toggleFavorite]
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
