"use client"

import Link from "next/link"
import { XIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  BETA_BANNER_LEAD,
  BETA_BANNER_REPORT,
  BETA_BANNER_REPORT_HREF,
  persistBetaBannerDismissed,
  readBetaBannerDismissed,
  shouldShowBetaBanner,
} from "@/lib/beta-banner"

/**
 * Thin sitewide beta notice above the header (SMA-126). Quiet utility
 * chrome, dismissible, localStorage so it does not nag every visit.
 */
export function BetaBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    setDismissed(readBetaBannerDismissed())
    setStorageReady(true)
  }, [])

  if (!shouldShowBetaBanner({ storageReady, dismissed })) {
    return null
  }

  return (
    <div
      className="border-b border-border bg-muted/70 text-muted-foreground"
      role="status"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-1.5 sm:px-5">
        <p className="min-w-0 flex-1 text-center text-xs leading-snug sm:text-sm">
          {BETA_BANNER_LEAD}{" "}
          <Link
            href={BETA_BANNER_REPORT_HREF}
            className="font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
          >
            {BETA_BANNER_REPORT}
          </Link>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss beta banner"
          onClick={() => {
            persistBetaBannerDismissed(true)
            setDismissed(true)
          }}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  )
}
