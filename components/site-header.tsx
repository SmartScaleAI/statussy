import Link from "next/link"

import { ModeToggle } from "@/components/mode-toggle"

/** Shared page chrome: brand mark (links home) + theme toggle. */
export function SiteHeader() {
  return (
    <header className="flex h-14 w-full items-center justify-between px-4 sm:h-16 sm:px-5">
      <Link
        href="/"
        className="flex items-center gap-2.5 font-heading text-2xl font-semibold leading-none tracking-tight text-foreground"
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
      <ModeToggle />
    </header>
  )
}
