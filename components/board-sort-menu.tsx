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
  parseSortBy,
  SORT_BY_KEY,
  SORT_BY_LABEL,
  SORT_BY_VALUES,
  type SortBy,
} from "@/lib/board-sort"

const listeners = new Set<() => void>()

function emitSortChange() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribeSortBy(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SORT_BY_KEY) {
      listener()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function getSortBySnapshot() {
  try {
    return window.localStorage.getItem(SORT_BY_KEY)
  } catch {
    return null
  }
}

function getSortByServerSnapshot() {
  return null
}

function writeSortBy(sortBy: SortBy) {
  window.localStorage.setItem(SORT_BY_KEY, sortBy)
}

/**
 * Shared All Services / My Services sort. Persists in `statussy:sortBy`.
 * First visit (no key) is Issues first.
 */
export function useBoardSort() {
  const raw = useSyncExternalStore(
    subscribeSortBy,
    getSortBySnapshot,
    getSortByServerSnapshot
  )
  const sortBy = useMemo(() => parseSortBy(raw), [raw])

  const setSortBy = useCallback((next: SortBy) => {
    try {
      writeSortBy(next)
    } catch {
      // Private mode / quota: keep the last persisted value.
    }
    emitSortChange()
  }, [])

  return [sortBy, setSortBy] as const
}

export function BoardSortMenu({
  sortBy,
  onSortByChange,
}: {
  sortBy: SortBy
  onSortByChange: (next: SortBy) => void
}) {
  const label = SORT_BY_LABEL[sortBy]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" className="h-10 shrink-0" />
        }
      >
        <ArrowUpDownIcon data-icon="inline-start" />
        Sort by · {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={sortBy}
            onValueChange={(value) =>
              onSortByChange(parseSortBy(String(value)))
            }
          >
            {SORT_BY_VALUES.map((value) => (
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
