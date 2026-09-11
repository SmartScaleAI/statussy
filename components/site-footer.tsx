import Link from "next/link"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const GITHUB_REPO = "https://github.com/SmartScaleAI/statussy"

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mx-auto flex w-full max-w-7xl flex-col px-6 pb-10",
        className
      )}
    >
      <Separator />
      <div className="mt-8 flex flex-col items-center gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-3 sm:items-center sm:gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground"
        >
          {/* Light: black mark. Dark: white-on-black tile. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-light.svg"
            alt=""
            width={16}
            height={16}
            className="size-4 dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.svg"
            alt=""
            width={16}
            height={16}
            className="hidden size-4 dark:block"
          />
          Statussy
        </Link>
        <p className="text-center">
          © {new Date().getFullYear()} SmartScale Solutions LLC
        </p>
        <nav
          aria-label="Legal and source"
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-self-end"
        >
          <Link
            href="/privacy"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Terms
          </Link>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  )
}
