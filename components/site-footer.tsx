import Link from "next/link"

import { SuggestProviderForm } from "@/components/suggest-provider-form"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const GITHUB_REPO = "https://github.com/SmartScaleAI/statussy"

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-10",
        className
      )}
    >
      <Separator />
      <div className="course-design-board">
        <div className="card plain">
          <div className="suggest-card-body">
            <SuggestProviderForm />
          </div>
        </div>
      </div>
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
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 underline-offset-2 hover:text-foreground hover:underline sm:justify-self-end"
        >
          <GitHubMark className="size-3.5" />
          GitHub
        </a>
      </div>
    </footer>
  )
}
