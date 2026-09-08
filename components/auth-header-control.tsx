"use client"

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

function initialsFor(name: string | null | undefined, email: string) {
  const source = name?.trim() || email
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")
  return letters.toUpperCase()
}

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

  const { user } = session
  const email = user.email ?? ""
  const label = user.name?.trim() || email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={`Account, ${label}`}
            className="h-10 max-w-48 gap-2 px-2"
          />
        }
      >
        <Avatar size="sm">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>{initialsFor(user.name, email)}</AvatarFallback>
        </Avatar>
        <span className="hidden truncate sm:inline">{email || label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
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
