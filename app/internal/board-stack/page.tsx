import type { Metadata } from "next"

import { HomeBoardPage } from "@/components/home-board-page"

/**
 * Internal route for My Stack first paint (SMA-145). proxy.ts rewrites
 * `/` here when a session cookie and `statussy:boardTab=stack` are present.
 * Same per-request snapshot as the public board; no cookies/session/favorites
 * DB. Direct visits are redirected to `/`. Keep `revalidate` in sync with
 * `app/page.tsx`.
 */
export const revalidate = 0

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
}

export default function BoardStackPage() {
  return <HomeBoardPage initialTab="stack" />
}
