"use client"

import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import {
  ALL_CATEGORY,
  boardHref,
  CATEGORY_PARAM,
  parseCategoryParam,
} from "@/lib/board-filter"
import { chicletHoverClass } from "@/lib/chiclet"
import { cn } from "@/lib/utils"

const backLinkClass = cn(
  buttonVariants({ variant: "ghost", size: "default" }),
  chicletHoverClass,
  // SMA-88: keep the selected-chip fill, but use the thin gray card border
  // (border-border) instead of the heavier selected-category border from the
  // board filter.
  "border-border bg-[var(--bg-footer)] text-foreground"
)

function BackChiclet({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Back to all services"
      className={backLinkClass}
    >
      <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
      Back
    </Link>
  )
}

/**
 * Detail-page Back link that restores the board category filter (SMA-89).
 *
 * Reads `?category=` with `useSearchParams` on the client so the detail page
 * itself never touches request search params — that would opt the route out
 * of the 60s ISR cache (SMA-97). Render it inside `<Suspense>` with
 * `<BackToBoardLinkFallback />`: the cached shell carries the plain-board
 * Back link and hydration swaps in the filtered href. Arrow is SMA-94.
 */
export function BackToBoardLink({ categories }: { categories: string[] }) {
  const searchParams = useSearchParams()
  // Unknown or missing slugs validate down to All, i.e. the bare board URL.
  const category = parseCategoryParam(
    searchParams.get(CATEGORY_PARAM),
    categories
  )
  return <BackChiclet href={boardHref(category)} />
}

/** Same chip, bare board URL — what the cached HTML shows before hydration. */
export function BackToBoardLinkFallback() {
  return <BackChiclet href={boardHref(ALL_CATEGORY)} />
}
