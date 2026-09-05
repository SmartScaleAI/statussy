"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
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

const listeners = new Set<() => void>()

function emitFavoriteChange() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribeFavoriteIds(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FAVORITE_SERVICE_IDS_KEY) {
      listener()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function getFavoriteIdsSnapshot() {
  try {
    return window.localStorage.getItem(FAVORITE_SERVICE_IDS_KEY)
  } catch {
    return null
  }
}

function getFavoriteIdsServerSnapshot() {
  return null
}

export function FavoriteServicesProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(
    subscribeFavoriteIds,
    getFavoriteIdsSnapshot,
    getFavoriteIdsServerSnapshot
  )
  const favoriteIds = useMemo(() => parseFavoriteServiceIds(raw), [raw])

  const toggleFavorite = useCallback((id: string) => {
    const next = toggleFavoriteServiceId(
      parseFavoriteServiceIds(getFavoriteIdsSnapshot()),
      id
    )
    try {
      writeFavoriteServiceIds(next)
    } catch {
      // Private mode / quota: snapshot stays on the last persisted value.
    }
    emitFavoriteChange()
  }, [])

  const value = useMemo<FavoriteServicesContextValue>(
    () => ({
      favoriteIds,
      isFavorited: (itemId) => favoriteIds.includes(itemId),
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
