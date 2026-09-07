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
import { useSearchParams } from "next/navigation"

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
  boardHref,
  CATEGORY_PARAM,
  distinctCategories,
  filterBoardServices,
  formatCategoryLabel,
  parseCategoryParam,
  summarizeBoardItems,
  type BoardFilterItem,
} from "@/lib/board-filter"
import { paginateItems } from "@/lib/board-pagination"
import { sortBoardServices, type BoardSortItem } from "@/lib/board-sort"
import { chicletHoverClass, chicletSelectedClass } from "@/lib/chiclet"
import { cn } from "@/lib/utils"

export type BoardGridItem = BoardFilterItem & BoardSortItem

export function StatusBoardGrid({
  items,
  refreshedAt,
  children,
}: {
  items: BoardGridItem[]
  /** Last successful board update — rendered as the board freshness stamp. */
  refreshedAt: string
  children: ReactNode
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useBoardSort()
  const categories = useMemo(() => distinctCategories(items), [items])
  const options = useMemo(() => [ALL_CATEGORY, ...categories], [categories])
  // Category lives in the board URL (SMA-89) so detail → Back and deep links
  // restore the filter; unknown slugs fall back to All.
  const searchParams = useSearchParams()
  const category = parseCategoryParam(
    searchParams.get(CATEGORY_PARAM),
    categories
  )
  const setCategory = useCallback((next: string) => {
    // replaceState (not router.replace) keeps chip clicks client-only — no
    // server refetch — while still syncing useSearchParams here and in cards.
    window.history.replaceState(null, "", boardHref(next))
  }, [])
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

  const chicletScrollerRef = useRef<HTMLDivElement>(null)
  const [chicletFade, setChicletFade] = useState({ start: false, end: false })

  const updateChicletFade = useCallback(() => {
    const el = chicletScrollerRef.current
    if (!el) {
      return
    }
    const maxScroll = el.scrollWidth - el.clientWidth
    const start = el.scrollLeft > 1
    const end = el.scrollLeft < maxScroll - 1
    setChicletFade((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end }
    )
  }, [])

  useEffect(() => {
    const el = chicletScrollerRef.current
    if (!el) {
      return
    }
    updateChicletFade()
    const observer = new ResizeObserver(updateChicletFade)
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateChicletFade, options])

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
          refreshedAt={refreshedAt}
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
            ref={chicletScrollerRef}
            role="radiogroup"
            aria-label="Filter by category"
            className={cn(
              // Single row: overflow scrolls horizontally with the scrollbar
              // hidden cross-browser. 28px mask fades blend the chips into the
              // plain bg-background surface behind them (position-conditional:
              // start → right fade, mid → both, end → left fade).
              "-my-1 flex flex-nowrap items-center gap-1 overflow-x-auto py-1",
              "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              chicletFade.start &&
                chicletFade.end &&
                "[mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%-28px),transparent)]",
              chicletFade.start &&
                !chicletFade.end &&
                "[mask-image:linear-gradient(to_right,transparent,black_28px)]",
              !chicletFade.start &&
                chicletFade.end &&
                "[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
            )}
            onScroll={updateChicletFade}
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
                    chicletHoverClass,
                    selected && chicletSelectedClass
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
