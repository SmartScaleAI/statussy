import type { Metadata } from "next"

import { HomeBoardPage } from "@/components/home-board-page"

/**
 * Internal ISR variant for `/services` My Stack first paint (SMA-145).
 * Keep `revalidate` in sync with `app/internal/board-stack/page.tsx`.
 */
export const revalidate = 60

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
