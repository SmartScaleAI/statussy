"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth-provider"
import { authClient } from "@/lib/auth-client"
import { emailAvatarLetter } from "@/lib/sign-in-methods"

export function AuthHeaderControl() {
  const { isPending, isSignedIn, openLogin } = useAuth()
  const { data: session } = authClient.useSession()

  if (isPending) {
    return <div className="size-10" aria-hidden="true" />
  }

  if (!isSignedIn || !session?.user) {
    return (
      <Button
        type="button"
        variant="default"
        aria-label="Sign In"
        className="h-10"
        onClick={() => openLogin("login")}
      >
        Sign In
      </Button>
    )
  }

  const email = session.user.email ?? ""
  const letter = emailAvatarLetter(email)

  return (
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
          {session.user.image ? (
            <AvatarImage src={session.user.image} alt="" />
          ) : null}
          <AvatarFallback>{letter}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/settings" />}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void authClient.signOut()
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
