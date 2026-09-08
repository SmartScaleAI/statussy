"use client"

import { useEffect, useState, type FormEvent } from "react"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export type LoginIntent = "default" | "favorites"

function currentReturnPath() {
  const path = `${window.location.pathname}${window.location.search}`
  return path || "/"
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-icon="inline-start">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.14 15.23 0 12 0A12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75"
      />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-icon="inline-start">
      <path
        fill="currentColor"
        d="M12 .3a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 12 .3"
      />
    </svg>
  )
}

export function LoginDialog({
  open,
  intent,
  onOpenChange,
}: {
  open: boolean
  intent: LoginIntent
  onOpenChange: (open: boolean) => void
}) {
  const { data: session } = authClient.useSession()
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState<"magic" | "google" | "github" | null>(
    null
  )
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      onOpenChange(false)
    }
  }, [onOpenChange, session])

  useEffect(() => {
    if (!open) {
      setEmail("")
      setPending(null)
      setSent(false)
      setError(null)
    }
  }, [open])

  const favorites = intent === "favorites"
  const busy = pending !== null

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending("magic")
    const { error: sendError } = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: currentReturnPath(),
    })
    setPending(null)
    if (sendError) {
      setError(sendError.message || "Could not send the sign-in link.")
      return
    }
    setSent(true)
  }

  async function signInSocial(provider: "google" | "github") {
    setError(null)
    setPending(provider)
    const { error: socialError } = await authClient.signIn.social({
      provider,
      callbackURL: currentReturnPath(),
    })
    if (socialError) {
      setPending(null)
      setError(socialError.message || `Could not start ${provider} sign-in.`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // SMA-103 mobile class lock: below `md` the login dialog is
        // fullscreen + `rounded-none`. From `md` up: centered modal + radius.
        className="max-md:inset-0 max-md:flex max-md:h-svh max-md:max-w-none max-md:translate-none max-md:flex-col max-md:justify-center max-md:rounded-none md:max-w-sm"
      >
        <DialogHeader className="text-center">
          <DialogTitle>
            {favorites ? "Sign in to save your stack" : "Sign in"}
          </DialogTitle>
          <DialogDescription>
            {favorites
              ? "Sign in to save favorites and My Stack to your account."
              : "Use a magic link, Google, or GitHub. You stay on this page."}
          </DialogDescription>
        </DialogHeader>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          {sent ? (
            <p
              className="text-center text-sm text-muted-foreground"
              role="status"
            >
              Check your email for a sign-in link.
            </p>
          ) : (
            <form onSubmit={sendMagicLink}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="login-email">Email</FieldLabel>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={email}
                    disabled={busy}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {pending === "magic" ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  Send magic link
                </Button>
              </FieldGroup>
            </form>
          )}
          <FieldSeparator>or</FieldSeparator>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void signInSocial("google")}
            >
              {pending === "google" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <GoogleMark />
              )}
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void signInSocial("github")}
            >
              {pending === "github" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <GitHubMark />
              )}
              Continue with GitHub
            </Button>
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
