import type { Metadata } from "next"

import { HomeBoardPage } from "@/components/home-board-page"

/**
 * Internal ISR variant for My Stack first paint (SMA-145). proxy.ts rewrites
 * `/` here when a session cookie and `statussy:boardTab=stack` are present.
 * Same 60s snapshot as the public board; no cookies/session/favorites DB.
 * Direct visits are redirected to `/`.
 */
export const revalidate = 60

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
