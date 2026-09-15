"use client"

import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { SearchIcon, StarIcon } from "lucide-react"

import { useBoardTabActions } from "@/components/board-panes"
import { BrandLoader } from "@/components/brand-loader"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { filterServicesByName } from "@/lib/board-filter"
import { sortBoardServices, type BoardSortItem } from "@/lib/board-sort"
import { selectFavoriteServices } from "@/lib/favorite-services"
import { summarizeServices, type BoardStatus } from "@/lib/status"

export type MyServiceItem = BoardSortItem & {
  status: BoardStatus
}

export function MyServices({
  items,
  refreshedAt,
  children,
}: {
  items: MyServiceItem[]
  /** Last successful board update — same stamp as All Services (SMA-141). */
  refreshedAt: string
  children: ReactNode
}) {
  const { favoriteIds, isLoading } = useFavoriteServices()
  const { showAllServices } = useBoardTabActions()
  const [query, setQuery] = useState("")
  const [sortBy, setSortBy] = useMyStackSort()
  const favorites = useMemo(
    () => selectFavoriteServices(items, favoriteIds),
    [favoriteIds, items]
  )
  const visible = useMemo(
    () => sortBoardServices(filterServicesByName(favorites, query), sortBy),
    [favorites, query, sortBy]
  )
  const summary = summarizeServices(visible)
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
  const cards = visible
    .map((item) => cardsById.get(item.id))
    .filter((card): card is ReactNode => card != null)
  // Loading is not empty (SMA-111): keep the empty copy off until favorites settle.
  const noFavorites = !isLoading && favorites.length === 0
  const noMatch = !isLoading && favorites.length > 0 && cards.length === 0

  return (
    <section
      className="flex flex-col gap-8"
      aria-labelledby="my-services-heading"
      aria-busy={isLoading || undefined}
    >
      <div className="flex flex-col gap-3">
        <h2
          id="my-services-heading"
          className="font-heading text-lg font-semibold tracking-tight text-foreground md:text-xl"
        >
          My Stack
        </h2>
        <StatusSummary
          operational={summary.operational}
          issues={summary.issues}
          total={summary.total}
          refreshedAt={refreshedAt}
        />
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <InputGroup className="h-10 min-w-0 flex-1">
            <InputGroupInput
              id="my-stack-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search services by name..."
              aria-label="Search services by name"
              className="h-10"
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <MyStackSortMenu sortBy={sortBy} onSortByChange={setSortBy} />
        </div>
        {isLoading ? (
          <BrandLoader className="pt-8 pb-10" label="Loading your stack" />
        ) : noFavorites ? (
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
        ) : noMatch ? (
          <p className="text-sm text-muted-foreground" role="status">
            No services match.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-3">
            {cards}
          </ul>
        )}
      </div>
    </section>
  )
}
