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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8 sm:py-12">
        <StatusBoard />
      </main>
      <SiteFooter />
    </div>
  )
}
