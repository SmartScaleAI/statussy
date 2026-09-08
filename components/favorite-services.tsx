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
  const { isSignedIn } = useAuth()
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  useEffect(() => {
    if (!isSignedIn) {
      setFavoriteIds([])
      return
    }
    let cancelled = false
    void getMyFavorites().then((result) => {
      if (cancelled) {
        return
      }
      setFavoriteIds(result.signedIn ? result.favoriteIds : [])
    })
    return () => {
      cancelled = true
    }
  }, [isSignedIn])

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

  const value = useMemo<FavoriteServicesContextValue>(
    () => ({
      signedIn: isSignedIn,
      favoriteIds,
      isFavorited: (itemId) => favoriteIds.includes(itemId),
      toggleFavorite,
    }),
    [favoriteIds, isSignedIn, toggleFavorite]
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
