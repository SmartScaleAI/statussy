import type { Metadata } from "next"

import { HomeBoardPage } from "@/components/home-board-page"
import { DEFAULT_BOARD_TAB } from "@/lib/board-tab"

/**
 * Per-request render. `revalidate = 60` made Vercel serve the previous
 * HTML on the request that noticed the page was stale
 * (`x-vercel-cache: STALE`) and only a later reload saw the new
 * snapshots, so status checks lagged across several refreshes. `0` keeps
 * this response tied to the snapshots read for it. Do not read cookies(),
 * headers(), or the Better Auth session here — signed-in My Stack first
 * paint is a second route selected by proxy.ts, and header Sign In vs
 * avatar uses a JS hint cookie (SMA-147). Must stay a literal — Next
 * requires `revalidate` to be statically analyzable.
 */
export const revalidate = 0

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
}

export default function HomePage() {
  return <HomeBoardPage initialTab={DEFAULT_BOARD_TAB} />
}
