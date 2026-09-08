"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export type LoginIntent = "default" | "favorites"

type LoginDialogContextValue = {
  open: boolean
  intent: LoginIntent
  openLogin: (intent?: LoginIntent) => void
  setOpen: (open: boolean) => void
}

const LoginDialogContext = createContext<LoginDialogContextValue | null>(null)

export function useLoginDialog() {
  const context = useContext(LoginDialogContext)
  if (!context) {
    throw new Error("useLoginDialog must be used within LoginDialogProvider")
  }
  return context
}

function currentCallbackURL() {
  return `${window.location.pathname}${window.location.search}`
}

function GitHubMark(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 10.0.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.378.203 2.397.1 2.65.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12c0-5.523-4.477-10-10-10Z" />
    </svg>
  )
}

function GoogleMark(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.97 6.97 0 0 1 5.44 12c0-.73.13-1.43.4-2.09V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  )
}

function LoginDialogForm({ intent }: { intent: LoginIntent }) {
  const { data: session } = authClient.useSession()
  const { setOpen } = useLoginDialog()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState<"magic" | "google" | "github" | null>(
    null
  )

  useEffect(() => {
    if (session) {
      setOpen(false)
    }
  }, [session, setOpen])

  const submitMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextEmail = email.trim()
    if (!nextEmail) {
      setError("Enter your email to get a sign-in link.")
      return
    }
    setError(null)
    setPending("magic")
    const { error: magicError } = await authClient.signIn.magicLink({
      email: nextEmail,
      callbackURL: currentCallbackURL(),
    })
    setPending(null)
    if (magicError) {
      setError(magicError.message ?? "Could not send a sign-in link.")
      return
    }
    setSent(true)
  }

  const signInSocial = async (provider: "google" | "github") => {
    setError(null)
    setPending(provider)
    const { error: socialError } = await authClient.signIn.social({
      provider,
      callbackURL: currentCallbackURL(),
    })
    setPending(null)
    if (socialError) {
      setError(socialError.message ?? `Could not start ${provider} sign-in.`)
    }
  }

  const title =
    intent === "favorites" ? "Sign in to save your stack" : "Sign in"
  const description =
    intent === "favorites"
      ? "Create a free account to star services and keep My Stack."
      : "Use a magic link or continue with Google or GitHub."

  return (
    <>
      <DialogHeader className="w-full max-w-sm text-center">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form
        className="flex w-full max-w-sm flex-col"
        onSubmit={submitMagicLink}
      >
        <FieldGroup>
          <Field data-invalid={error && !sent ? true : undefined}>
            <FieldLabel htmlFor="login-email">Email</FieldLabel>
            <Input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              aria-invalid={error && !sent ? true : undefined}
              onChange={(event) => {
                setEmail(event.target.value)
                setSent(false)
                setError(null)
              }}
            />
            {error ? <FieldError>{error}</FieldError> : null}
            {sent ? (
              <p className="text-sm text-muted-foreground" role="status">
                Check your email for a sign-in link. You can close this and
                stay on the board.
              </p>
            ) : null}
          </Field>
          <Button type="submit" disabled={pending !== null}>
            {pending === "magic" ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            Send magic link
          </Button>
          <FieldSeparator>or</FieldSeparator>
          <Button
            type="button"
            variant="outline"
            disabled={pending !== null}
            onClick={() => void signInSocial("google")}
          >
            {pending === "google" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <GoogleMark data-icon="inline-start" />
            )}
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending !== null}
            onClick={() => void signInSocial("github")}
          >
            {pending === "github" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <GitHubMark data-icon="inline-start" />
            )}
            Continue with GitHub
          </Button>
        </FieldGroup>
      </form>
    </>
  )
}

function LoginDialog() {
  const { open, intent, setOpen } = useLoginDialog()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-md:inset-0 max-md:flex max-md:h-dvh max-md:max-h-dvh max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:flex-col max-md:items-center max-md:justify-center max-md:rounded-none max-md:ring-0 md:max-w-sm">
        <LoginDialogForm intent={intent} />
      </DialogContent>
    </Dialog>
  )
}

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false)
  const [intent, setIntent] = useState<LoginIntent>("default")

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    if (!next) {
      setIntent("default")
    }
  }, [])

  const openLogin = useCallback((nextIntent: LoginIntent = "default") => {
    setIntent(nextIntent)
    setOpenState(true)
  }, [])

  return (
    <LoginDialogContext.Provider
      value={{ open, intent, openLogin, setOpen }}
    >
      {children}
      <LoginDialog />
    </LoginDialogContext.Provider>
  )
}
