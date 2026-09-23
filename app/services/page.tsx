import type { Metadata } from "next"

import { HomeBoardPage } from "@/components/home-board-page"
import { DEFAULT_BOARD_TAB } from "@/lib/board-tab"

// `/services` is an alias of the board. Route segment config does not travel
// through a re-export, so the cache mode is declared here too — keep it in
// sync with `app/page.tsx` (`false`: cached until the worker deletes it).
// Do not read cookies here.
export const revalidate = false

export const metadata: Metadata = {
  alternates: {
    canonical: "/services",
  },
}

export default function ServicesPage() {
  return <HomeBoardPage initialTab={DEFAULT_BOARD_TAB} />
}
