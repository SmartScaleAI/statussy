"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, type SVGProps } from "react"

import {
  deleteMyAccount,
  getMyAccountSnapshot,
  unlinkSocialAccount,
} from "@/app/actions/account"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { signOutAndInvalidateViews } from "@/lib/client-sign-out"
import {
  LAST_METHOD_COPY,
  SIGN_IN_QUERY,
  canUnlinkSocialProvider,
  type LinkedAccount,
  type SocialProvider,
} from "@/lib/sign-in-methods"
import { shouldRenderAccountSettings } from "@/lib/settings-session"

function GoogleMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.55-5.17 3.55-8.66"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3.01c-1.08.72-2.47 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.25A7.2 7.2 0 0 1 4.89 12c0-.78.13-1.54.38-2.25V6.64H1.27A12 12 0 0 0 0 12c0 1.94.46 3.78 1.27 5.36z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.14 15.23 0 12 0A12 12 0 0 0 1.27 6.64l4 3.11C6.22 6.86 8.87 4.75 12 4.75"
      />
    </svg>
  )
}

function GitHubMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .3a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 12 .3" />
    </svg>
  )
}

const PROVIDERS: {
  id: SocialProvider
  label: string
  Mark: typeof GoogleMark
}[] = [
  { id: "google", label: "Google", Mark: GoogleMark },
  { id: "github", label: "GitHub", Mark: GitHubMark },
]

export function SettingsForm() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const [snapshot, setSnapshot] = useState<{
    email: string
    accounts: LinkedAccount[]
  } | null>(null)
  const [pending, setPending] = useState<
    SocialProvider | "signout" | "delete" | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const hasUser = Boolean(session?.user)
  const showAccount = shouldRenderAccountSettings({
    isPending: sessionPending,
    hasUser,
  })
  const busy = pending !== null

  useEffect(() => {
    if (sessionPending) {
      return
    }
    if (!hasUser) {
      setSnapshot(null)
      if (pathname === "/settings") {
        router.replace(`/?${SIGN_IN_QUERY}=1`)
        router.refresh()
      }
      return
    }
    let cancelled = false
    void getMyAccountSnapshot().then((result) => {
      if (cancelled) {
        return
      }
      if (!result.ok) {
        setSnapshot(null)
        router.replace(`/?${SIGN_IN_QUERY}=1`)
        router.refresh()
        return
      }
      setSnapshot({ email: result.email, accounts: result.accounts })
    })
    return () => {
      cancelled = true
    }
  }, [hasUser, pathname, router, sessionPending])

  if (!showAccount || !snapshot) {
    const waiting = sessionPending || hasUser
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {waiting ? "Loading account…" : "Redirecting to sign in…"}
      </p>
    )
  }

  const { email, accounts } = snapshot

  async function onConnect(provider: SocialProvider) {
    setError(null)
    setPending(provider)
    const { error: linkError } = await authClient.linkSocial({
      provider,
      callbackURL: "/settings",
    })
    if (linkError) {
      setPending(null)
      setError(linkError.message || `Could not connect ${provider}.`)
    }
  }

  async function onDisconnect(provider: SocialProvider) {
    setError(null)
    setPending(provider)
    const result = await unlinkSocialAccount(provider)
    setPending(null)
    if (!result.ok) {
      if (result.error === "signed-out") {
        router.push(`/?${SIGN_IN_QUERY}=1`)
        return
      }
      setError(
        result.error === "last-method"
          ? LAST_METHOD_COPY
          : `Could not disconnect ${provider}.`
      )
      return
    }
    const next = await getMyAccountSnapshot()
    if (!next.ok) {
      router.replace(`/?${SIGN_IN_QUERY}=1`)
      router.refresh()
      return
    }
    setSnapshot({ email: next.email, accounts: next.accounts })
    router.refresh()
  }

  async function onSignOut() {
    setError(null)
    setPending("signout")
    setSnapshot(null)
    await signOutAndInvalidateViews()
    router.replace("/")
    router.refresh()
  }

  async function onDeleteAccount() {
    setError(null)
    setPending("delete")
    const result = await deleteMyAccount()
    if (!result.ok) {
      setPending(null)
      if (result.error === "signed-out") {
        router.push(`/?${SIGN_IN_QUERY}=1`)
        return
      }
      setError("Could not delete your account. Try again.")
      return
    }
    setSnapshot(null)
    await signOutAndInvalidateViews()
    setDeleteOpen(false)
    router.replace("/")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>The email on this Statussy account.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="settings-email">Email</FieldLabel>
              <Input
                id="settings-email"
                type="email"
                value={email}
                readOnly
                disabled
                autoComplete="email"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
          <CardDescription>
            Link Google or GitHub to sign in. You cannot disconnect your only
            remaining method.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-4">
            {PROVIDERS.map(({ id, label, Mark }) => {
              const connected = accounts.some((row) => row.providerId === id)
              const canUnlink = canUnlinkSocialProvider(accounts, id)
              return (
                <li
                  key={id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Mark className="size-5 shrink-0" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-medium">{label}</span>
                      <Badge variant={connected ? "secondary" : "outline"}>
                        {connected ? "Connected" : "Not connected"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    {connected ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || !canUnlink}
                        onClick={() => onDisconnect(id)}
                      >
                        {pending === id ? "Disconnecting…" : "Disconnect"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => onConnect(id)}
                      >
                        <Mark data-icon="inline-start" />
                        {pending === id ? "Redirecting…" : "Connect"}
                      </Button>
                    )}
                    {connected && !canUnlink ? (
                      <p className="max-w-sm text-xs text-muted-foreground">
                        {LAST_METHOD_COPY}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          {error ? <FieldError className="mt-4">{error}</FieldError> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>
            Sign out of Statussy on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void onSignOut()
            }}
          >
            {pending === "signout" ? "Signing out…" : "Sign out"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently delete your account, sessions, and My Stack favorites.
            This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger
              render={<Button variant="destructive" disabled={busy} />}
            >
              Delete account
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes {email || "your account"}, signs you
                  out, and removes your My Stack favorites. You cannot undo
                  this.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending === "delete"}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={pending === "delete"}
                  onClick={(event) => {
                    event.preventDefault()
                    void onDeleteAccount()
                  }}
                >
                  {pending === "delete" ? "Deleting…" : "Delete account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
