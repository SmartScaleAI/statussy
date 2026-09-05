"use client"

import { Children, isValidElement, useMemo, type ReactNode } from "react"

import { useBoardSort } from "@/components/board-sort-menu"
import { useFavoriteServices } from "@/components/favorite-services"
import { StatusSummary } from "@/components/status-summary"
import { sortBoardServices, type BoardSortItem } from "@/lib/board-sort"
import { selectFavoriteServices } from "@/lib/favorite-services"
import { summarizeServices, type BoardStatus } from "@/lib/status"
import { boardPaperClassName, cn } from "@/lib/utils"

export type MyServiceItem = BoardSortItem & {
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
  const [sortBy] = useBoardSort()
  const favorites = useMemo(
    () => sortBoardServices(selectFavoriteServices(items, favoriteIds), sortBy),
    [favoriteIds, items, sortBy]
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
      className={cn(
        "flex flex-col",
        boardPaperClassName,
        empty ? "gap-3" : "gap-8"
      )}
      aria-labelledby="my-services-heading"
    >
      <div className="flex flex-col gap-3">
        <h2
          id="my-services-heading"
          className="font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          My Services
        </h2>
        <StatusSummary
          operational={summary.operational}
          issues={summary.issues}
          total={summary.total}
        />
      </div>
      {empty ? (
        <p className="pt-1 text-sm text-muted-foreground" role="status">
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
