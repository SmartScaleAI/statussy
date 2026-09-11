import { EmailAlertsBanner } from "@/components/email-alerts-banner"
import { ReportSuggestPanel } from "@/components/report-suggest-panel"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { StatusBoard } from "@/components/status-board"

/**
 * ISR (SMA-97): serve the board from the Vercel/Next page cache and
 * re-render at most every 60s. Data only changes on the worker's 5m tick,
 * so a ≤60s-old view stays well inside the freshness floor, and repeated
 * hits (incl. bots) stop costing an invocation + a Postgres round trip each.
 * Must stay a literal — Next requires this to be statically analyzable.
 */
export const revalidate = 60

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 sm:py-12">
        <EmailAlertsBanner />
        {/* SMA-120: board (~80%) + skinny Report/Suggest rail (~20%),
            centered. Mobile stacks the panel under the full list.
            Desktop rail is sticky so it stays visible while scrolling. */}
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-center">
          <div className="min-w-0 flex-1">
            <StatusBoard />
          </div>
          <aside
            className="w-full md:sticky md:top-6 md:w-[22%] md:max-w-[18rem] md:min-w-[14rem] md:shrink-0"
            aria-label="Report or suggest"
          >
            <ReportSuggestPanel />
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
