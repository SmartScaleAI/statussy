"use client"

import { useEffect, useState } from "react"
import { XIcon } from "lucide-react"

import {
  dismissDigestBanner,
  getMyDigestPrefs,
  setMyDigestEmail,
} from "@/app/actions/digest-prefs"
import { useFavoriteServices } from "@/components/favorite-services"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { shouldShowDigestBanner } from "@/lib/digest-banner"
import {
  DEFAULT_DIGEST_PREFS,
  type UserDigestPrefs,
} from "@/lib/user-digest-prefs"

/**
 * After the first My Stack star: opt-in CTA + dismiss (SMA-115).
 * Sits above the My Stack section, below a divider. Dismiss persists
 * until the user enables alerts (banner or settings).
 */
export function DigestOptInBanner() {
  const { signedIn, favoriteIds, isLoading } = useFavoriteServices()
  const [prefs, setPrefs] = useState<UserDigestPrefs | null>(null)
  const [pending, setPending] = useState<"enable" | "dismiss" | null>(null)

  useEffect(() => {
    if (!signedIn) {
      setPrefs(null)
      return
    }
    let cancelled = false
    void getMyDigestPrefs().then((result) => {
      if (cancelled) {
        return
      }
      setPrefs(
        result.signedIn
          ? {
              emailMajorPartial: result.emailMajorPartial,
              bannerDismissed: result.bannerDismissed,
            }
          : null
      )
    })
    return () => {
      cancelled = true
    }
  }, [signedIn])

  const visible = shouldShowDigestBanner({
    signedIn,
    favoriteCount: favoriteIds.length,
    emailMajorPartial: prefs?.emailMajorPartial ?? DEFAULT_DIGEST_PREFS.emailMajorPartial,
    bannerDismissed: prefs?.bannerDismissed ?? DEFAULT_DIGEST_PREFS.bannerDismissed,
    prefsReady: prefs != null,
    favoritesReady: !isLoading,
  })

  if (!visible || !prefs) {
    return null
  }

  async function onEnable() {
    const previous = prefs
    setPending("enable")
    setPrefs({ ...previous, emailMajorPartial: true })
    const result = await setMyDigestEmail(true)
    setPending(null)
    if (!result.signedIn) {
      setPrefs(previous)
      return
    }
    setPrefs({
      emailMajorPartial: result.emailMajorPartial,
      bannerDismissed: result.bannerDismissed,
    })
  }

  async function onDismiss() {
    const previous = prefs
    setPending("dismiss")
    setPrefs({ ...previous, bannerDismissed: true })
    const result = await dismissDigestBanner()
    setPending(null)
    if (!result.signedIn) {
      setPrefs(previous)
      return
    }
    setPrefs({
      emailMajorPartial: result.emailMajorPartial,
      bannerDismissed: result.bannerDismissed,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Separator />
      <div
        className="flex gap-3 rounded-xl bg-card px-4 py-3 text-card-foreground ring-1 ring-foreground/10"
        role="region"
        aria-label="Email alerts"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-light.svg"
          alt=""
          width={20}
          height={20}
          className="mt-0.5 size-5 shrink-0 dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.svg"
          alt=""
          width={20}
          height={20}
          className="mt-0.5 hidden size-5 shrink-0 dark:block"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-heading text-sm font-medium">
              Email alerts for My Stack
            </p>
            <p className="text-sm text-muted-foreground">
              One email when a starred service newly hits a major or partial
              outage. Recoveries are not emailed yet.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending !== null}
              onClick={() => {
                void onEnable()
              }}
            >
              {pending === "enable" ? "Enabling…" : "Enable email alerts"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={pending !== null}
              aria-label="Dismiss email alerts banner"
              onClick={() => {
                void onDismiss()
              }}
            >
              <XIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
