import { Separator } from "@/components/ui/separator"
import { formatTimestamp } from "@/lib/status"
import { cn } from "@/lib/utils"

type StatusSummaryProps = {
  operational: number
  issues: number
  total: number
  /** Omit on My Services so the board keeps a single refreshed clock. */
  refreshedAt?: string
}

export function StatusSummary({
  operational,
  issues,
  total,
  refreshedAt,
}: StatusSummaryProps) {
  const empty = total === 0
  const allClear = !empty && issues === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="text-sm" role="status" aria-live="polite">
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
        {refreshedAt ? (
          <p className="text-xs text-muted-foreground">
            Refreshed{" "}
            <time dateTime={refreshedAt}>{formatTimestamp(refreshedAt)}</time>
          </p>
        ) : null}
      </div>
      <Separator />
    </div>
  )
}
