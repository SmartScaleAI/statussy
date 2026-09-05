"use client"

import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { SearchIcon } from "lucide-react"

import { BoardSortMenu, useBoardSort } from "@/components/board-sort-menu"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { StatusSummary } from "@/components/status-summary"
import {
  ALL_CATEGORY,
  distinctCategories,
  filterBoardServices,
  formatCategoryLabel,
  summarizeBoardItems,
  type BoardFilterItem,
} from "@/lib/board-filter"
import { sortBoardServices, type BoardSortItem } from "@/lib/board-sort"
import { cn } from "@/lib/utils"

export type BoardGridItem = BoardFilterItem & BoardSortItem

export function StatusBoardGrid({
  items,
  children,
}: {
  items: BoardGridItem[]
  children: ReactNode
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(ALL_CATEGORY)
  const [sortBy, setSortBy] = useBoardSort()
  const categories = useMemo(() => distinctCategories(items), [items])
  const options = useMemo(() => [ALL_CATEGORY, ...categories], [categories])
  const visibleItems = useMemo(
    () =>
      sortBoardServices(filterBoardServices(items, query, category), sortBy),
    [items, query, category, sortBy]
  )
  const summary = useMemo(
    () => summarizeBoardItems(visibleItems),
    [visibleItems]
  )
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
  const cards = visibleItems
    .map((item) => cardsById.get(item.id))
    .filter((card): card is ReactNode => card != null)

  function onChicletKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return
    }
    event.preventDefault()
    const index = options.indexOf(category)
    const delta = event.key === "ArrowRight" ? 1 : -1
    const next = options[(index + delta + options.length) % options.length]
    setCategory(next)
    const group = event.currentTarget
    queueMicrotask(() => {
      group.querySelector<HTMLElement>(`[data-category="${next}"]`)?.focus()
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2
          id="all-services-heading"
          className="font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          All Services
        </h2>
        <StatusSummary
          operational={summary.operational}
          issues={summary.issues}
          total={summary.total}
        />
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <InputGroup className="h-10 min-w-0 flex-1">
              <InputGroupInput
                id="service-search"
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
            <BoardSortMenu sortBy={sortBy} onSortByChange={setSortBy} />
          </div>
          <div
            role="radiogroup"
            aria-label="Filter by category"
            className="flex flex-wrap items-center gap-1"
            onKeyDown={onChicletKeyDown}
          >
            {options.map((id) => {
              const selected = category === id
              return (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  role="radio"
                  data-category={id}
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setCategory(id)}
                  className={cn(
                    "hover:bg-[var(--bg-footer)] dark:hover:bg-[var(--bg-footer)]",
                    selected &&
                      "border-[var(--color-gray-dark)] bg-[var(--bg-footer)] text-foreground"
                  )}
                >
                  {formatCategoryLabel(id)}
                </Button>
              )
            })}
          </div>
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">
            No services match.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-3">
            {cards}
          </ul>
        )}
      </div>
    </div>
  )
}
