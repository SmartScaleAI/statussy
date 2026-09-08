import Link from "next/link"

import { AuthControls } from "@/components/auth-controls"
import { ModeToggle } from "@/components/mode-toggle"

/**
 * Shared page chrome: brand mark (links home) + theme toggle + login.
 * The board freshness stamp lives with the All Services summary (SMA-83).
 */
export function SiteHeader() {
  return (
    <header className="flex h-14 w-full items-center justify-between px-4 sm:h-16 sm:px-5">
      <Link
        href="/"
        className="flex items-center gap-2.5 font-heading text-2xl leading-none font-semibold tracking-tight text-foreground"
      >
        {/* Light: black mark. Dark: white-on-black tile. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-light.svg"
          alt=""
          width={24}
          height={24}
          className="size-[1em] dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.svg"
          alt=""
          width={24}
          height={24}
          className="hidden size-[1em] dark:block"
        />
        Statussy
      </Link>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <AuthControls />
      </div>
    </header>
  )
}
