"use client"

import { Children, isValidElement, useMemo, type ReactNode } from "react"
import { StarIcon } from "lucide-react"

import { useBoardTabActions } from "@/components/board-panes"
import { MyStackSortMenu, useMyStackSort } from "@/components/board-sort-menu"
import { useFavoriteServices } from "@/components/favorite-services"
import { StatusSummary } from "@/components/status-summary"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { sortBoardServices, type BoardSortItem } from "@/lib/board-sort"
import { selectFavoriteServices } from "@/lib/favorite-services"
import { summarizeServices, type BoardStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

export type MyServiceItem = BoardSortItem & {
  status: BoardStatus
}

function MyStackLoader() {
  return (
    <div className="flex justify-center pt-8 pb-10">
      {/* Decorative: sr-only text is the accessible name. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/my-stack-loader.gif"
        alt=""
        width={32}
        height={32}
        className="size-8"
      />
      <span className="sr-only">Loading your stack</span>
    </div>
  )
}

export function MyServices({
  items,
  children,
}: {
  items: MyServiceItem[]
  children: ReactNode
}) {
  const { favoriteIds, isLoading } = useFavoriteServices()
  const { showAllServices } = useBoardTabActions()
  const [sortBy, setSortBy] = useMyStackSort()
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
  // Loading is not empty (SMA-111): keep the empty copy off until favorites settle.
  const empty = !isLoading && cards.length === 0

  return (
    <div
      className={cn("flex flex-col", empty || isLoading ? "gap-3" : "gap-8")}
      aria-busy={isLoading || undefined}
    >
      <StatusSummary
        operational={summary.operational}
        issues={summary.issues}
        total={summary.total}
        action={
          // Nothing to reorder while the stack is empty or still loading.
          !empty && !isLoading ? (
            <MyStackSortMenu sortBy={sortBy} onSortByChange={setSortBy} />
          ) : undefined
        }
      />
      {isLoading ? (
        <MyStackLoader />
      ) : empty ? (
        <Empty className="py-8" role="status">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <StarIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing in My Stack yet</EmptyTitle>
            <EmptyDescription>
              Star services in All Services to pin them here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" onClick={showAllServices}>
              Browse All Services
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-3">
          {cards}
        </ul>
      )}
    </div>
  )
}
