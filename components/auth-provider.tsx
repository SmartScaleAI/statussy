"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { LoginDialog, type LoginIntent } from "@/components/login-dialog"

export type { LoginIntent }

type LoginDialogContextValue = {
  openLogin: (intent?: LoginIntent) => void
}

const LoginDialogContext = createContext<LoginDialogContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [intent, setIntent] = useState<LoginIntent>("default")

  const openLogin = useCallback((next: LoginIntent = "default") => {
    setIntent(next)
    setOpen(true)
  }, [])

  const value = useMemo<LoginDialogContextValue>(
    () => ({ openLogin }),
    [openLogin]
  )

  return (
    <LoginDialogContext.Provider value={value}>
      {children}
      <LoginDialog open={open} intent={intent} onOpenChange={setOpen} />
    </LoginDialogContext.Provider>
  )
}

export function useLoginDialog() {
  const context = useContext(LoginDialogContext)
  if (!context) {
    throw new Error("useLoginDialog must be used within AuthProvider")
  }
  return context
}
