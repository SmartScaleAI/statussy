"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react"

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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

export type LoginReason = "default" | "favorites"

type LoginDialogContextValue = {
  openLogin: (reason?: LoginReason) => void
}

const LoginDialogContext = createContext<LoginDialogContextValue | null>(null)

export function useLoginDialog() {
  const context = useContext(LoginDialogContext)
  if (!context) {
    throw new Error("useLoginDialog must be used within LoginDialogProvider")
  }
  return context
}

function currentReturnPath() {
  return `${window.location.pathname}${window.location.search}`
}

function GoogleIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.42"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.97-.9 6.63-2.35l-3.23-2.5c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.06v2.58A9.99 9.99 0 0 0 12 22"
      />
      <path
        fill="currentColor"
        d="M6.39 13.98A6 6 0 0 1 6.08 12c0-.69.12-1.35.31-1.98V7.44H3.06A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.06 4.56z"
      />
      <path
        fill="currentColor"
        d="M12 5.89c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.91 14.7 2 12 2A9.99 9.99 0 0 0 3.06 7.44l3.33 2.58C7.18 7.65 9.39 5.89 12 5.89"
      />
    </svg>
  )
}

function GitHubIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.36 6.84 9.72.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.67.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2"
      />
    </svg>
  )
}

function LoginDialogForm({ reason }: { reason: LoginReason }) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState<"magic" | "google" | "github" | null>(
    null
  )
  const busy = pending !== null

  const sendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setPending("magic")
    const { error: signInError } = await authClient.signIn.magicLink({
      email,
      callbackURL: currentReturnPath(),
    })
    setPending(null)
    if (signInError) {
      setError(signInError.message || "Could not send a magic link.")
      return
    }
    setSent(true)
  }

  const signInSocial = async (provider: "google" | "github") => {
    setError(null)
    setPending(provider)
    const { error: signInError } = await authClient.signIn.social({
      provider,
      callbackURL: currentReturnPath(),
    })
    if (signInError) {
      setPending(null)
      setError(signInError.message || `Could not start ${provider} sign-in.`)
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <DialogHeader className="items-center">
        <DialogTitle>
          {reason === "favorites" ? "Sign in to save your stack" : "Sign in"}
        </DialogTitle>
        <DialogDescription>
          {reason === "favorites"
            ? "Sign in to save favorites to My Stack."
            : "Use a magic link or continue with Google or GitHub."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={sendMagicLink} className="mt-4 w-full">
        <FieldGroup className="gap-3">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="login-email">Email</FieldLabel>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={busy}
              aria-invalid={error ? true : undefined}
              placeholder="you@example.com"
              onChange={(event) => {
                setEmail(event.target.value)
                setSent(false)
              }}
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {pending === "magic" ? <Spinner data-icon="inline-start" /> : null}
            Send magic link
          </Button>
          {sent ? (
            <p className="text-sm text-muted-foreground" role="status">
              Check your email for a sign-in link.
            </p>
          ) : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </FieldGroup>
      </form>
      <div className="mt-4 flex w-full items-center gap-2">
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
      <div className="mt-4 flex w-full flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className="w-full"
          onClick={() => signInSocial("google")}
        >
          {pending === "google" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <GoogleIcon data-icon="inline-start" />
          )}
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className="w-full"
          onClick={() => signInSocial("github")}
        >
          {pending === "github" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <GitHubIcon data-icon="inline-start" />
          )}
          Continue with GitHub
        </Button>
      </div>
    </div>
  )
}

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<LoginReason>("default")

  const openLogin = useCallback((nextReason: LoginReason = "default") => {
    setReason(nextReason)
    setOpen(true)
  }, [])

  return (
    <LoginDialogContext.Provider value={{ openLogin }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <LoginDialogForm key={`${open}-${reason}`} reason={reason} />
        </DialogContent>
      </Dialog>
    </LoginDialogContext.Provider>
  )
}
