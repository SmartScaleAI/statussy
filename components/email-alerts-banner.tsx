"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { XIcon } from "lucide-react"

import {
  dismissDigestBanner,
  getMyDigestPrefs,
} from "@/app/actions/digest-prefs"
import { useAuth } from "@/components/auth-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  ALERTS_BANNER_BODY,
  ALERTS_BANNER_CTA,
  ALERTS_BANNER_HREF,
  DEFAULT_DIGEST_PREFS,
  persistLocalBannerDismissed,
  pickDigestPrefs,
  readLocalBannerDismissed,
  shouldShowDigestBanner,
  type UserDigestPrefs,
} from "@/lib/digest-banner"
import { cn } from "@/lib/utils"

/**
 * Top-of-board alerts promo (SMA-115 / SMA-118 / SMA-142). CTA deep-links
 * to Settings alerts. X persists dismiss until they opt in from Settings.
 */
export function EmailAlertsBanner() {
  const { isPending, isSignedIn } = useAuth()
  const [prefs, setPrefs] = useState<UserDigestPrefs | null>(null)
  const [localDismissed, setLocalDismissed] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setLocalDismissed(readLocalBannerDismissed())
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (isPending) {
      return
    }
    if (!isSignedIn) {
      setPrefs(null)
      return
    }
    let cancelled = false
    void getMyDigestPrefs().then((result) => {
      if (cancelled) {
        return
      }
      setPrefs(result.signedIn ? pickDigestPrefs(result) : DEFAULT_DIGEST_PREFS)
    })
    return () => {
      cancelled = true
    }
  }, [isPending, isSignedIn])

  useEffect(() => {
    if (!isSignedIn || !prefs || prefs.emailEnabled || prefs.bannerDismissed) {
      return
    }
    if (!localDismissed) {
      return
    }
    let cancelled = false
    void dismissDigestBanner().then((result) => {
      if (cancelled || !result.signedIn) {
        return
      }
      setPrefs(pickDigestPrefs(result))
    })
    return () => {
      cancelled = true
    }
  }, [isSignedIn, localDismissed, prefs])

  const visible = shouldShowDigestBanner({
    authPending: isPending,
    signedIn: isSignedIn,
    emailEnabled: prefs?.emailEnabled ?? DEFAULT_DIGEST_PREFS.emailEnabled,
    prefsReady: prefs != null,
    localDismissed,
    storageReady,
  })

  if (!visible) {
    return null
  }

  async function onDismiss() {
    persistLocalBannerDismissed(true)
    setLocalDismissed(true)
    if (!isSignedIn) {
      return
    }
    const previous = prefs ?? DEFAULT_DIGEST_PREFS
    setPending(true)
    setPrefs({ ...previous, bannerDismissed: true })
    const result = await dismissDigestBanner()
    setPending(false)
    if (!result.signedIn) {
      setPrefs(previous)
      return
    }
    setPrefs(pickDigestPrefs(result))
  }

  return (
    <div
      className="flex gap-3 rounded-xl bg-card px-4 py-3 text-card-foreground ring-1 ring-foreground/10"
      role="region"
      aria-label="My Stack alerts"
    >
      {/* Light: black mark. Dark: white-on-black tile. */}
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
            {ALERTS_BANNER_BODY}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={ALERTS_BANNER_HREF}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            {ALERTS_BANNER_CTA}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label="Dismiss alerts banner"
            onClick={() => {
              void onDismiss()
            }}
          >
            <XIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
