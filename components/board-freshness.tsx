"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import {
  boardFreshnessTitle,
  formatRelativeAge,
  isBoardStale,
} from "@/lib/board-freshness"

/** Re-render cadence — labels have minute granularity, 30s keeps them honest. */
const TICK_MS = 30_000

/**
 * Board freshness stamp (SMA-83). Healthy = a quiet relative stamp
 * ("Updated 2m ago") with absolute UTC + poll cadence in the tooltip.
 * Stale (worker/poller dead or aged data) = a loud "Updates delayed" chip.
 *
 * SSR + hydrate: the server prerenders the label from its own clock and the
 * client re-computes every `TICK_MS` after mount. The two clocks can
 * disagree by a minute bucket, so the label carries
 * `suppressHydrationWarning`; the fresh/stale branch only flips if the
 * 15-minute threshold is crossed in the seconds between prerender and
 * hydration, which React recovers from with a client render.
 */
export function BoardFreshness({ refreshedAt }: { refreshedAt: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const title = boardFreshnessTitle(refreshedAt)

  if (isBoardStale(refreshedAt, now)) {
    return (
      <Badge variant="warning" title={title} role="status">
        Updates delayed
      </Badge>
    )
  }

  return (
    <p className="text-xs text-muted-foreground" title={title}>
      <time dateTime={refreshedAt} suppressHydrationWarning>
        Updated {formatRelativeAge(refreshedAt, now)}
      </time>
    </p>
  )
}
