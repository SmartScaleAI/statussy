"use client"

import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { ArrowUpDownIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  ALL_CATEGORY,
  distinctCategories,
  filterBoardServices,
  formatCategoryLabel,
  type BoardFilterItem,
} from "@/lib/board-filter"
import { cn } from "@/lib/utils"

export function StatusBoardGrid({
  items,
  children,
}: {
  items: BoardFilterItem[]
  children: ReactNode
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(ALL_CATEGORY)
  const categories = useMemo(() => distinctCategories(items), [items])
  const options = useMemo(() => [ALL_CATEGORY, ...categories], [categories])
  const visibleIds = useMemo(
    () =>
      new Set(
        filterBoardServices(items, query, category).map((item) => item.id)
      ),
    [items, query, category]
  )
  const cards = Children.toArray(children).filter((child, index) => {
    const id = items[index]?.id
    return id != null && visibleIds.has(id) && isValidElement(child)
  })

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
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Sort"
            className="size-10"
          >
            <ArrowUpDownIcon />
          </Button>
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
              <button
                key={id}
                type="button"
                role="radio"
                data-category={id}
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setCategory(id)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  selected
                    ? "bg-foreground font-medium text-background ring-2 ring-[var(--clr-blue)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {formatCategoryLabel(id)}
              </button>
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
  )
}
