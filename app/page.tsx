import type { Metadata } from "next"

import { HomeBoardPage } from "@/components/home-board-page"
import { DEFAULT_BOARD_TAB } from "@/lib/board-tab"

/**
 * ISR (SMA-97 / SMA-145): serve the board from the Vercel/Next page cache
 * and re-render at most every 60s. The page must not read cookies(),
 * headers(), or the Better Auth session — that opts the shared snapshot
 * out of the cache. Signed-in My Stack first paint is a second ISR
 * variant selected by proxy.ts from cookies only. Header Sign In vs
 * avatar uses a JS hint cookie (SMA-147), not cookies() here. Must stay
 * a literal — Next requires `revalidate` to be statically analyzable.
 */
export const revalidate = 60

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
}

export default function HomePage() {
  return <HomeBoardPage initialTab={DEFAULT_BOARD_TAB} />
}
