"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { ArrowUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MY_STACK_SORT_BY_KEY,
  MY_STACK_SORT_BY_VALUES,
  parseMyStackSortBy,
  parseSortBy,
  SORT_BY_KEY,
  SORT_BY_LABEL,
  SORT_BY_VALUES,
  type MyStackSortBy,
  type SortBy,
} from "@/lib/board-sort"

/** localStorage-synced sort state; one store per storage key. */
function createSortStore(storageKey: string) {
  const listeners = new Set<() => void>()

  function emit() {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === storageKey) {
          listener()
        }
      }
      window.addEventListener("storage", onStorage)
      return () => {
        listeners.delete(listener)
        window.removeEventListener("storage", onStorage)
      }
    },
    getSnapshot() {
      try {
        return window.localStorage.getItem(storageKey)
      } catch {
        return null
      }
    },
    getServerSnapshot() {
      return null
    },
    write(value: string) {
      try {
        window.localStorage.setItem(storageKey, value)
      } catch {
        // Private mode / quota: keep the last persisted value.
      }
      emit()
    },
  }
}

type SortStore = ReturnType<typeof createSortStore>

const boardSortStore = createSortStore(SORT_BY_KEY)
const myStackSortStore = createSortStore(MY_STACK_SORT_BY_KEY)

function useStoredSort<T extends string>(
  store: SortStore,
  parse: (raw: string | null) => T
) {
  const raw = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
  const sortBy = useMemo(() => parse(raw), [parse, raw])

  const setSortBy = useCallback((next: T) => store.write(next), [store])

  return [sortBy, setSortBy] as const
}

/**
 * All Services board sort. Persists in `statussy:sortBy`.
 * First visit (no key) is Issues first.
 */
export function useBoardSort() {
  return useStoredSort(boardSortStore, parseSortBy)
}

/**
 * My Stack-only sort (SMA-92) — independent of the board sort. Persists in
 * `statussy:myStackSortBy`; first visit (no key) is Issues first.
 */
export function useMyStackSort() {
  return useStoredSort(myStackSortStore, parseMyStackSortBy)
}

function SortMenu<T extends SortBy>({
  sortBy,
  values,
  onSortByChange,
  ariaContext,
}: {
  sortBy: T
  values: readonly T[]
  onSortByChange: (next: T) => void
  /** Accessible-name prefix, e.g. "Sort by" / "Sort My Stack by". */
  ariaContext: string
}) {
  const label = SORT_BY_LABEL[sortBy]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={`${ariaContext}, ${label}`}
            className="h-10 shrink-0 max-md:w-10 max-md:px-0"
          />
        }
      >
        <ArrowUpDownIcon />
        {/*
          Below `md` (768px) the trigger is icon-only; the aria-label above
          keeps the current sort mode in the accessible name.
        */}
        <span className="max-md:hidden">Sort by · {label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={sortBy}
            onValueChange={(value) => {
              const next = values.find((candidate) => candidate === value)
              if (next) {
                onSortByChange(next)
              }
            }}
          >
            {values.map((value) => (
              <DropdownMenuRadioItem key={value} value={value} closeOnClick>
                {SORT_BY_LABEL[value]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function BoardSortMenu({
  sortBy,
  onSortByChange,
}: {
  sortBy: SortBy
  onSortByChange: (next: SortBy) => void
}) {
  return (
    <SortMenu
      sortBy={sortBy}
      values={SORT_BY_VALUES}
      onSortByChange={onSortByChange}
      ariaContext="Sort by"
    />
  )
}

export function MyStackSortMenu({
  sortBy,
  onSortByChange,
}: {
  sortBy: MyStackSortBy
  onSortByChange: (next: MyStackSortBy) => void
}) {
  return (
    <SortMenu
      sortBy={sortBy}
      values={MY_STACK_SORT_BY_VALUES}
      onSortByChange={onSortByChange}
      ariaContext="Sort My Stack by"
    />
  )
}
