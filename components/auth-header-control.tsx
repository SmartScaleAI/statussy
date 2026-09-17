"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth-provider"
import { ModeToggle, ThemeMenuSub } from "@/components/mode-toggle"
import { authClient } from "@/lib/auth-client"
import {
  clearAuthHeaderHint,
  applyAuthHeaderHintDocument,
} from "@/lib/auth-header-hint"
import { signOutAndInvalidateViews } from "@/lib/client-sign-out"
import { emailAvatarLetter } from "@/lib/sign-in-methods"

function SignedOutChrome({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div data-auth-chrome="signed-out" className="flex items-center gap-2">
      <ModeToggle />
      <Button
        type="button"
        variant="default"
        aria-label="Sign In"
        className="h-10"
        onClick={onSignIn}
      >
        Sign In
      </Button>
    </div>
  )
}

function SignedInChrome({
  email,
  image,
  onSignOut,
}: {
  email: string
  image?: string | null
  onSignOut: () => void
}) {
  const letter = emailAvatarLetter(email)

  return (
    <div data-auth-chrome="signed-in">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={email || "Account"}
              className="size-10 rounded-full"
            />
          }
        >
          <Avatar className="size-8">
            {image ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback>{letter}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href="/settings" />}>
              Settings
            </DropdownMenuItem>
            <ThemeMenuSub />
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/**
 * SMA-147: both chromes stay in the cached HTML. `data-auth-hint` (set by
 * a blocking script from `statussy:authHint`) shows avatar vs Sign In on
 * first paint. Do not read cookies() here — that dynamizes `/`.
 */
export function AuthHeaderControl() {
  const { openLogin } = useAuth()
  const { data: session } = authClient.useSession()
  const router = useRouter()
  const pathname = usePathname()

  const email = session?.user?.email ?? ""
  const image = session?.user?.image

  return (
    <>
      <SignedOutChrome onSignIn={() => openLogin("login")} />
      <SignedInChrome
        email={email}
        image={image}
        onSignOut={() => {
          clearAuthHeaderHint()
          applyAuthHeaderHintDocument(false)
          void (async () => {
            await signOutAndInvalidateViews()
            if (pathname === "/settings") {
              router.replace("/")
            }
            router.refresh()
          })()
        }}
      />
    </>
  )
}
