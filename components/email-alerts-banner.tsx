"use client"

import { useEffect, useState } from "react"
import { XIcon } from "lucide-react"

import {
  dismissDigestBanner,
  enableMyDigest,
  getMyDigestPrefs,
} from "@/app/actions/digest-prefs"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  DEFAULT_DIGEST_PREFS,
  OPT_IN_DIGEST_PREFS,
  persistLocalBannerDismissed,
  pickDigestPrefs,
  readLocalBannerDismissed,
  shouldShowDigestBanner,
  type UserDigestPrefs,
} from "@/lib/digest-banner"

/**
 * Top-of-board opt-in (SMA-115 / SMA-118). Signed-out CTA opens the login
 * dialog. Signed-in CTA enables master + Major (Partial stays off). X
 * persists dismiss until they opt in from Settings.
 */
export function EmailAlertsBanner() {
  const { isPending, isSignedIn, openLogin } = useAuth()
  const [prefs, setPrefs] = useState<UserDigestPrefs | null>(null)
  const [localDismissed, setLocalDismissed] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [pending, setPending] = useState<"enable" | "dismiss" | null>(null)

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
    bannerDismissed:
      prefs?.bannerDismissed ?? DEFAULT_DIGEST_PREFS.bannerDismissed,
    prefsReady: prefs != null,
    localDismissed,
    storageReady,
  })

  if (!visible) {
    return null
  }

  async function onEnable() {
    const previous = prefs ?? DEFAULT_DIGEST_PREFS
    setPending("enable")
    setPrefs(OPT_IN_DIGEST_PREFS)
    const result = await enableMyDigest()
    setPending(null)
    if (!result.signedIn) {
      setPrefs(previous)
      return
    }
    persistLocalBannerDismissed(true)
    setLocalDismissed(true)
    setPrefs(pickDigestPrefs(result))
  }

  async function onDismiss() {
    persistLocalBannerDismissed(true)
    setLocalDismissed(true)
    if (!isSignedIn) {
      return
    }
    const previous = prefs ?? DEFAULT_DIGEST_PREFS
    setPending("dismiss")
    setPrefs({ ...previous, bannerDismissed: true })
    const result = await dismissDigestBanner()
    setPending(null)
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
      aria-label="Email alerts"
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
            Email alerts for My Stack
          </p>
          <p className="text-sm text-muted-foreground">
            One email when a starred service newly hits a major outage. Partial
            stays off until you turn it on in Settings. Recoveries are not
            emailed yet.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isSignedIn ? (
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
          ) : (
            <Button type="button" size="sm" onClick={() => openLogin("alerts")}>
              Sign in to enable email alerts
            </Button>
          )}
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
  )
}
