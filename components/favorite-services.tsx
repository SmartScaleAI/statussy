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
  const [signedIn, setSignedIn] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const signedInRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void getMyFavorites().then((result) => {
      if (cancelled) {
        return
      }
      signedInRef.current = result.signedIn
      setSignedIn(result.signedIn)
      setFavoriteIds(result.favoriteIds)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    // Signed-out star clicks are owned by SMA-103 (login dialog). Do not
    // write localStorage or persist anonymous favorites.
    if (!signedInRef.current) {
      return
    }
    setFavoriteIds((prev) => {
      const next = toggleFavoriteServiceId(prev, id)
      void toggleMyFavorite(id).then((result) => {
        signedInRef.current = result.signedIn
        setSignedIn(result.signedIn)
        if (result.signedIn) {
          setFavoriteIds(result.favoriteIds)
        } else {
          setFavoriteIds(prev)
        }
      })
      return next
    })
  }, [])

  const value = useMemo<FavoriteServicesContextValue>(
    () => ({
      signedIn,
      favoriteIds,
      isFavorited: (itemId) => favoriteIds.includes(itemId),
      toggleFavorite,
    }),
    [favoriteIds, signedIn, toggleFavorite]
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
