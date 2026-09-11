import type { Metadata } from "next"

import { EmailAlertsBanner } from "@/components/email-alerts-banner"
import { RecentlyAddedPanel } from "@/components/recently-added-panel"
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

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
}

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 sm:py-12">
        <EmailAlertsBanner />
        {/* SMA-124: board (~76%) + rail (~24%), centered.
            Desktop: aside stretches with the board so the inner
            wrapper stays sticky. Mobile: column stack under the
            board — Recently added, then Report/Suggest. */}
        <div className="flex flex-col gap-8 md:flex-row md:justify-center">
          <div className="min-w-0 flex-1 md:max-w-[76%]">
            <StatusBoard />
          </div>
          <aside
            className="w-full md:w-[24%] md:max-w-[20rem] md:min-w-[14rem] md:shrink-0"
            aria-label="Recently added and report"
          >
            <div className="flex flex-col gap-4 md:sticky md:top-4 md:z-10">
              <RecentlyAddedPanel />
              <ReportSuggestPanel />
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
