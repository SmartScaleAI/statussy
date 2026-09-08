"use client"

import { Suspense, useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { SIGN_IN_QUERY } from "@/lib/auth-client"

/**
 * Signed-out `/settings` redirects to `/?signin=1`. Open the existing
 * Sign In dialog and drop the query so the board URL stays clean.
 */
function SignInFromQueryInner() {
  const { isPending, isSignedIn, openLogin } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isPending || searchParams.get(SIGN_IN_QUERY) !== "1") {
      return
    }
    if (!isSignedIn) {
      openLogin("login")
    }
    const next = new URLSearchParams(searchParams.toString())
    next.delete(SIGN_IN_QUERY)
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }, [isPending, isSignedIn, openLogin, pathname, router, searchParams])

  return null
}

export function SignInFromQuery() {
  return (
    <Suspense fallback={null}>
      <SignInFromQueryInner />
    </Suspense>
  )
}
