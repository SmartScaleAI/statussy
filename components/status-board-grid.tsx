"use client"

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { SearchIcon } from "lucide-react"

import { BoardPagination } from "@/components/board-pagination"
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
import { paginateItems } from "@/lib/board-pagination"
import { sortBoardServices, type BoardSortItem } from "@/lib/board-sort"
import { cn } from "@/lib/utils"

export type BoardGridItem = BoardFilterItem & BoardSortItem

// ~28px edge fade (Avery UX lock). A CSS mask fades the chips themselves, so
// the fade always matches the board surface instead of overlaying a color.
const CHIP_FADE_MASKS = {
  both: "[mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%_-_28px),transparent)]",
  left: "[mask-image:linear-gradient(to_right,transparent,black_28px)]",
  right:
    "[mask-image:linear-gradient(to_right,black_calc(100%_-_28px),transparent)]",
} as const

/**
 * Tracks whether a horizontal scroller has overflow on each side, so edge
 * fades can be conditional: at start → right only, mid → both, end → left
 * only.
 */
function useScrollEdges(deps: readonly unknown[]) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current
    if (!el) {
      return
    }
    const maxScroll = el.scrollWidth - el.clientWidth
    setEdges({
      left: el.scrollLeft > 1,
      right: el.scrollLeft < maxScroll - 1,
    })
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) {
      return
    }
    updateEdges()
    const observer = new ResizeObserver(updateEdges)
    observer.observe(el)
    return () => observer.disconnect()
    // Re-measure when the scroller contents change (e.g. category list).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateEdges, ...deps])

  return { scrollerRef, edges, updateEdges }
}

export function StatusBoardGrid({
  items,
  children,
}: {
  items: BoardGridItem[]
  children: ReactNode
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(ALL_CATEGORY)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useBoardSort()
  const categories = useMemo(() => distinctCategories(items), [items])
  const options = useMemo(() => [ALL_CATEGORY, ...categories], [categories])
  const {
    scrollerRef: chipScrollerRef,
    edges: chipEdges,
    updateEdges: updateChipEdges,
  } = useScrollEdges([options])
  const visibleItems = useMemo(
    () =>
      sortBoardServices(filterBoardServices(items, query, category), sortBy),
    [items, query, category, sortBy]
  )
  const paged = useMemo(
    () => paginateItems(visibleItems, page),
    [visibleItems, page]
  )
  const summary = useMemo(
    () => summarizeBoardItems(visibleItems),
    [visibleItems]
  )

  useEffect(() => {
    setPage(1)
  }, [query, category, sortBy])

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
  const cards = paged.pageItems
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
            ref={chipScrollerRef}
            role="radiogroup"
            aria-label="Filter by category"
            className={cn(
              // Single row: horizontal scroll with the scrollbar hidden
              // (touch/trackpad/wheel and arrow-key nav still scroll).
              "-mx-1 -my-1 flex flex-nowrap items-center gap-1 overflow-x-auto px-1 py-1",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              chipEdges.left && chipEdges.right
                ? CHIP_FADE_MASKS.both
                : chipEdges.left
                  ? CHIP_FADE_MASKS.left
                  : chipEdges.right
                    ? CHIP_FADE_MASKS.right
                    : undefined
            )}
            onScroll={updateChipEdges}
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
          <>
            <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-3">
              {cards}
            </ul>
            <BoardPagination
              page={paged.page}
              pageCount={paged.pageCount}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
