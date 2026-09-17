import { EmailAlertsBanner } from "@/components/email-alerts-banner"
import { RecentlyAddedPanel } from "@/components/recently-added-panel"
import { ReportSuggestPanel } from "@/components/report-suggest-panel"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { StatusBoard } from "@/components/status-board"
import type { BoardTab } from "@/lib/board-tab"

/**
 * Shared `/` and `/services` chrome. `initialTab` selects which ISR HTML
 * variant to emit (SMA-145): All Services on the public routes, My Stack
 * on the internal rewrite targets. Must not read cookies/session here.
 * Header auth chrome uses a JS hint cookie (SMA-147), not cookies().
 */
export function HomeBoardPage({ initialTab }: { initialTab: BoardTab }) {
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
            <StatusBoard initialTab={initialTab} />
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
