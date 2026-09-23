import type { Metadata } from "next"

import { HomeBoardPage } from "@/components/home-board-page"

/**
 * Internal route for `/services` My Stack first paint (SMA-145).
 * Keep `revalidate` in sync with `app/internal/board-stack/page.tsx`.
 */
export const revalidate = false

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "/services",
  },
}

export default function BoardStackServicesPage() {
  return <HomeBoardPage initialTab="stack" />
}
