import Link from "next/link"

import { getStatusBoard } from "@/lib/status-board"
import { formatTimestamp } from "@/lib/status"

/** Shared page chrome: brand mark (links home) + refreshed clock. */
export async function SiteHeader() {
  const { refreshedAt } = await getStatusBoard()

  return (
    <header className="flex h-14 w-full items-center justify-between px-4 sm:h-16 sm:px-5">
      <Link
        href="/"
        className="flex items-center gap-2.5 font-heading text-2xl leading-none font-semibold tracking-tight text-foreground"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.svg"
          alt=""
          width={24}
          height={24}
          className="size-[1em]"
        />
        Statussy
      </Link>
      <p className="text-xs text-muted-foreground">
        Refreshed{" "}
        <time dateTime={refreshedAt}>{formatTimestamp(refreshedAt)}</time>
      </p>
    </header>
  )
}
