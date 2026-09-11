"use client"

import { FavoriteButton } from "@/components/favorite-button"
import { FavoriteServicesProvider } from "@/components/favorite-services"

/**
 * Detail-page star (SMA-128). Same toggle + login dialog as the board.
 * Provider is local so the ISR-cached page never embeds a user's stack.
 */
export function ServiceDetailFavorite({ serviceId }: { serviceId: string }) {
  return (
    <FavoriteServicesProvider>
      <FavoriteButton
        serviceId={serviceId}
        className="relative z-10 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:text-foreground [&_svg]:size-5"
      />
    </FavoriteServicesProvider>
  )
}
