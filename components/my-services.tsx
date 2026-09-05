"use client"

import {
  Children,
  isValidElement,
  useMemo,
  type ReactNode,
} from "react"

import { useFavoriteServices } from "@/components/favorite-services"
import { StatusSummary } from "@/components/status-summary"
import { selectFavoriteServices } from "@/lib/favorite-services"
import { summarizeServices, type BoardStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

export type MyServiceItem = {
  id: string
  status: BoardStatus
}

export function MyServices({
  items,
  children,
}: {
  items: MyServiceItem[]
  children: ReactNode
}) {
  const { favoriteIds } = useFavoriteServices()
  const favorites = useMemo(
    () => selectFavoriteServices(items, favoriteIds),
    [favoriteIds, items]
  )
  const summary = summarizeServices(favorites)
  const cardsById = useMemo(() => {
    const map = new Map<string, ReactNode>()
    Children.toArray(children).forEach((child, index) => {
      const id = items[index]?.id
      if (id && isValidElement(child)) {
        map.set(id, child)
      }
    })
    return map
  }, [children, items])
  const cards = favorites
    .map((item) => cardsById.get(item.id))
    .filter((card): card is ReactNode => card != null)
  const empty = cards.length === 0

  return (
    <section
      className={cn("flex flex-col", empty ? "gap-3" : "gap-8")}
      aria-labelledby="my-stack-heading"
    >
      <div className="flex flex-col gap-3">
        <h2
          id="my-stack-heading"
          className="font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          My Stack
        </h2>
        <StatusSummary
          operational={summary.operational}
          issues={summary.issues}
          total={summary.total}
        />
      </div>
      {empty ? (
        <p className="py-1 text-sm text-muted-foreground" role="status">
          Star services below to pin them here.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-3">
          {cards}
        </ul>
      )}
    </section>
  )
}
