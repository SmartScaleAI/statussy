"use client"

import { Badge } from "@/components/ui/badge"
import { useBoardNow } from "@/components/board-clock"
import {
  boardFreshnessTitle,
  formatRelativeAge,
  isBoardStale,
} from "@/lib/board-freshness"

/**
 * Board freshness stamp (SMA-83). Healthy = a quiet relative stamp
 * ("Updated 2m ago") with absolute UTC + poll cadence in the tooltip.
 * Stale (worker/poller dead or aged data) = a loud "Updates delayed" chip.
 *
 * The clock and the ISR re-read live in `BoardFreshnessProvider`, shared
 * with card footers so the two surfaces age the same payload. SSR + hydrate
 * can disagree by a cache window; the label carries `suppressHydrationWarning`.
 * The fresh/stale branch only flips when the 15-minute threshold is crossed
 * between prerender and hydration, which React recovers from on the client.
 */
export function BoardFreshness({ refreshedAt }: { refreshedAt: string }) {
  const now = useBoardNow()
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
