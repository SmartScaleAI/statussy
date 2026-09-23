import type { Metadata } from "next"

import { HomeBoardPage } from "@/components/home-board-page"
import { DEFAULT_BOARD_TAB } from "@/lib/board-tab"

/**
 * Cache the board until the worker deletes it.
 *
 * `revalidate = 60` made Vercel serve the previous HTML on the request
 * that noticed the page was stale (`x-vercel-cache: STALE`); only a later
 * reload saw the new snapshots. `0` avoided that by rendering every
 * request from Postgres, which made hard refresh wait on a full dynamic
 * render. `false` keeps a CDN/full-route cache (fast refresh) with no
 * time-based stale-while-revalidate window. After a tick, the worker
 * `POST`s `/api/revalidate-board`, which calls `revalidatePath("/", "layout")`
 * with no cache profile so the next request regenerates in the foreground.
 *
 * Do not read cookies(), headers(), or the Better Auth session here —
 * signed-in My Stack first paint is a second route selected by proxy.ts,
 * and header Sign In vs avatar uses a JS hint cookie (SMA-147). Must stay
 * a literal — Next requires `revalidate` to be statically analyzable.
 */
export const revalidate = false

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
}

export default function HomePage() {
  return <HomeBoardPage initialTab={DEFAULT_BOARD_TAB} />
}
