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
        {/* SMA-122: board (~70%) + Report/Suggest rail (~30%),
            centered. Desktop: aside stretches with the board so the
            inner wrapper can stay sticky at the top while the list
            scrolls. Mobile: column stack, panel last, no sticky. */}
        <div className="flex flex-col gap-8 md:flex-row md:justify-center">
          <div className="min-w-0 flex-1 md:max-w-[70%]">
            <StatusBoard />
          </div>
          <aside
            className="w-full md:w-[30%] md:max-w-[24rem] md:min-w-[14rem] md:shrink-0"
            aria-label="Report or suggest"
          >
            <div className="md:sticky md:top-4 md:z-10">
              <ReportSuggestPanel />
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
