"use client"

import { StarIcon } from "lucide-react"
import type { MouseEvent } from "react"

import { useAuth } from "@/components/auth-provider"
import { useFavoriteServices } from "@/components/favorite-services"
import { cn } from "@/lib/utils"

/**
 * Shared My Stack star (SMA-103 / SMA-128). Signed-in toggles Railway
 * favorites; signed-out opens the login dialog and does not write.
 */
export function FavoriteButton({
  serviceId,
  className,
}: {
  serviceId: string
  className?: string
}) {
  const { isFavorited, toggleFavorite } = useFavoriteServices()
  const { isPending, isSignedIn, openLogin } = useAuth()
  const favorited = isFavorited(serviceId)

  return (
    <button
      type="button"
      className={cn("btn-favorite", favorited && "is-favorited", className)}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        event.stopPropagation()
        if (isPending) {
          return
        }
        if (!isSignedIn) {
          openLogin("favorites")
          return
        }
        toggleFavorite(serviceId)
      }}
    >
      <StarIcon aria-hidden="true" fill={favorited ? "currentColor" : "none"} />
    </button>
  )
}
