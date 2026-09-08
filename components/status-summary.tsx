import type { ReactNode } from "react"

import { BoardFreshness } from "@/components/board-freshness"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type StatusSummaryProps = {
  operational: number
  issues: number
  total: number
  /**
   * Optional. The one board-level freshness stamp (SMA-83) — only the
   * All Services summary passes it, so the board has a single clock.
   */
  refreshedAt?: string
  /**
   * Optional control on the issues-count row, immediately above the
   * gray divider (SMA-101). Used by My Stack for the sort menu so the
   * button sits inline with the left issues text instead of the heading.
   */
  action?: ReactNode
}

export function StatusSummary({
  operational,
  issues,
  total,
  refreshedAt,
  action,
}: StatusSummaryProps) {
  const empty = total === 0
  const allClear = !empty && issues === 0

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "flex",
          action
            ? "items-center justify-between gap-2"
            : "flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        )}
      >
        <p className="min-w-0 text-sm" role="status" aria-live="polite">
          {empty ? (
            <span className="text-muted-foreground">
              0 issues · 0 operational
            </span>
          ) : allClear ? (
            <span className="text-success">All {total} operational</span>
          ) : (
            <>
              <span
                className={cn(
                  "font-medium",
                  issues >= 2 ? "text-destructive" : "text-warning"
                )}
              >
                {issues} {issues === 1 ? "issue" : "issues"}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {operational} operational
              </span>
            </>
          )}
        </p>
        {action ??
          (refreshedAt ? <BoardFreshness refreshedAt={refreshedAt} /> : null)}
      </div>
      <Separator />
    </div>
  )
}
