"use client"

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"

import { BOARD_REFRESH_MS, isBoardStale } from "@/lib/board-freshness"

/** Same cadence as the badge label. Minute buckets do not need a faster tick. */
const TICK_MS = 30_000

/**
 * Ignore a second refresh inside this window so a remount during
 * `router.refresh()` cannot tight-loop while the worker is actually down.
 */
const MIN_REFRESH_GAP_MS = 10_000

const BoardNowContext = createContext<number | null>(null)

/** Survives a refresh remount so a stale board cannot tight-loop. */
let lastBoardRefreshAt = 0

export function useBoardNow() {
  const now = useContext(BoardNowContext)
  if (now == null) {
    throw new Error("useBoardNow must be used within BoardFreshnessProvider")
  }
  return now
}

/**
 * One clock for the board badge and card footers, plus a re-read of the
 * ISR payload while the tab is visible.
 *
 * `router.refresh()` clears the client cache and re-renders server
 * components without dropping client state. The board route is
 * per-request, so this re-read is the latest snapshots rather than a
 * stale ISR document. A healthy worker moves `refreshedAt` forward. A
 * multi-tick gap leaves it old, and the badge still goes loud.
 */
export function BoardFreshnessProvider({
  refreshedAt,
  children,
}: {
  refreshedAt: string
  children: ReactNode
}) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, TICK_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden") return
      const t = Date.now()
      if (t - lastBoardRefreshAt < MIN_REFRESH_GAP_MS) return
      lastBoardRefreshAt = t
      startTransition(() => {
        router.refresh()
      })
    }

    if (isBoardStale(refreshedAt)) refresh()

    const id = setInterval(refresh, BOARD_REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refreshedAt, router])

  return (
    <BoardNowContext.Provider value={now}>{children}</BoardNowContext.Provider>
  )
}
