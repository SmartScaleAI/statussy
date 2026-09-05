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

import {
  FAVORITE_SERVICE_IDS_KEY,
  parseFavoriteServiceIds,
  toggleFavoriteServiceId,
  writeFavoriteServiceIds,
} from "@/lib/favorite-services"

type FavoriteServicesContextValue = {
  favoriteIds: readonly string[]
  isFavorited: (id: string) => boolean
  toggleFavorite: (id: string) => void
}

const FavoriteServicesContext =
  createContext<FavoriteServicesContextValue | null>(null)

export function FavoriteServicesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  useEffect(() => {
    setFavoriteIds(
      parseFavoriteServiceIds(
        window.localStorage.getItem(FAVORITE_SERVICE_IDS_KEY)
      )
    )
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = toggleFavoriteServiceId(prev, id)
      try {
        writeFavoriteServiceIds(next)
      } catch {
        // Private mode / quota: keep the in-memory set for this session.
      }
      return next
    })
  }, [])

  const value = useMemo<FavoriteServicesContextValue>(
    () => ({
      favoriteIds,
      isFavorited: (id) => favoriteIds.includes(id),
      toggleFavorite,
    }),
    [favoriteIds, toggleFavorite]
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
