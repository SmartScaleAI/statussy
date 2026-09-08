"use client"

import { authClient } from "@/lib/auth-client"
import { useLoginDialog } from "@/components/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function initialsFor(user: { name?: string | null; email?: string | null }) {
  const source = user.name?.trim() || user.email?.trim() || "?"
  return source.slice(0, 2).toUpperCase()
}

export function AuthControls() {
  const { data: session, isPending } = authClient.useSession()
  const { openLogin } = useLoginDialog()

  if (isPending) {
    return <div className="size-10" aria-hidden="true" />
  }

  const user = session?.user
  if (!user) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-10"
        onClick={() => openLogin("default")}
      >
        Login
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Account"
            className="size-10"
          />
        }
      >
        <Avatar size="sm">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>{initialsFor(user)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          {user.email ? (
            <DropdownMenuLabel className="max-w-52 truncate">
              {user.email}
            </DropdownMenuLabel>
          ) : null}
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
