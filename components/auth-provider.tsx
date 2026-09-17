"use client"

import { useRouter } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { authClient } from "@/lib/auth-client"
import {
  resolveAuthHeaderSessionStatus,
  syncAuthHeaderHintFromSession,
} from "@/lib/auth-header-hint"
import { LoginDialog, type LoginReason } from "@/components/login-dialog"
import { SignInFromQuery } from "@/components/sign-in-from-query"

type AuthContextValue = {
  isPending: boolean
  isSignedIn: boolean
  openLogin: (reason?: LoginReason) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()
  const wasSignedIn = useRef(false)
  const seenSessionPending = useRef(false)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<LoginReason>("login")

  const openLogin = useCallback((nextReason: LoginReason = "login") => {
    setReason(nextReason)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (session) {
      setOpen(false)
    }
  }, [session])

  useEffect(() => {
    const signedIn = Boolean(session)
    if (wasSignedIn.current && !signedIn) {
      router.refresh()
    }
    wasSignedIn.current = signedIn
  }, [router, session])

  // SMA-147: keep the JS hint cookie + data-auth-hint in sync after the
  // session settles. Do not call cookies() — header chrome only.
  useLayoutEffect(() => {
    if (isPending) {
      seenSessionPending.current = true
    }
    syncAuthHeaderHintFromSession({
      sessionStatus: resolveAuthHeaderSessionStatus({
        isPending,
        hasSession: Boolean(session),
        seenPending: seenSessionPending.current,
      }),
    })
  }, [isPending, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      isPending,
      isSignedIn: Boolean(session),
      openLogin,
    }),
    [isPending, openLogin, session]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SignInFromQuery />
      <LoginDialog open={open} onOpenChange={setOpen} reason={reason} />
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
