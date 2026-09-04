import { GithubIcon } from "lucide-react"
import Link from "next/link"

import { SuggestProviderForm } from "@/components/suggest-provider-form"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const GITHUB_REPO = "https://github.com/SmartScaleAI/statussy"

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-10",
        className
      )}
    >
      <Separator />
      <SuggestProviderForm />
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-3 sm:items-center sm:gap-3">
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
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 underline-offset-2 hover:text-foreground hover:underline sm:justify-self-end"
        >
          <GithubIcon aria-hidden="true" className="size-3.5" />
          GitHub
        </a>
      </div>
    </footer>
  )
}
