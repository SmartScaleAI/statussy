"use client"

import { useState, type FormEvent, type SVGProps } from "react"

import { authClient, currentCallbackPath } from "@/lib/auth-client"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type LoginReason = "login" | "favorites" | "alerts"

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

export function LoginDialog({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason: LoginReason
}) {
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState<"magic" | "google" | "github" | null>(
    null
  )
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const favorites = reason === "favorites"
  const alerts = reason === "alerts"
  const busy = pending !== null

  const title = alerts
    ? "Sign in to enable email alerts"
    : favorites
      ? "Sign in to save your stack"
      : "Sign in"
  const description = alerts
    ? "You need an account to get email when My Stack hits a major or partial outage."
    : favorites
      ? "You need an account to save favorites to My Stack."
      : "Use a magic link or continue with Google or GitHub."

  async function onMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.")
      return
    }
    setError(null)
    setPending("magic")
    const { error: sendError } = await authClient.signIn.magicLink({
      email: trimmed,
      name: trimmed.split("@")[0],
      callbackURL: currentCallbackPath(),
    })
    setPending(null)
    if (sendError) {
      setError(sendError.message || "Could not send a sign-in link.")
      return
    }
    setSentTo(trimmed)
  }

  async function onSocial(provider: "google" | "github") {
    setError(null)
    setPending(provider)
    const { error: socialError } = await authClient.signIn.social({
      provider,
      callbackURL: currentCallbackPath(),
    })
    if (socialError) {
      setPending(null)
      setError(socialError.message || `Could not start ${provider} sign-in.`)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null)
          setSentTo(null)
          setPending(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        className={cn(
          "sm:max-w-none md:max-w-sm",
          "max-md:top-0 max-md:left-0 max-md:flex max-md:h-svh max-md:max-h-svh max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:flex-col max-md:justify-center max-md:rounded-none max-md:ring-0"
        )}
      >
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          {sentTo ? (
            <p
              className="text-center text-sm text-muted-foreground"
              role="status"
            >
              Check {sentTo} for a sign-in link. You can close this and stay on
              the board.
            </p>
          ) : (
            <form onSubmit={onMagicLink}>
              <FieldGroup>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="login-email">Email</FieldLabel>
                  <Input
                    id="login-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    disabled={busy}
                    aria-invalid={error ? true : undefined}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setError(null)
                    }}
                  />
                  <FieldDescription>
                    We’ll email you a one-time sign-in link.
                  </FieldDescription>
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
                <Button type="submit" disabled={busy} className="w-full">
                  {pending === "magic" ? "Sending link…" : "Send magic link"}
                </Button>
              </FieldGroup>
            </form>
          )}
          <FieldSeparator>or</FieldSeparator>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => onSocial("google")}
            >
              <GoogleMark data-icon="inline-start" />
              {pending === "google" ? "Redirecting…" : "Continue with Google"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => onSocial("github")}
            >
              <GitHubMark data-icon="inline-start" />
              {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
