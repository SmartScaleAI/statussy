"use client"

import { authClient } from "@/lib/auth-client"
import { useLoginDialog } from "@/components/login-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function accountInitial(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?"
  return source.slice(0, 1).toUpperCase()
}

export function AuthHeaderControl() {
  const { data: session, isPending } = authClient.useSession()
  const { openLogin } = useLoginDialog()

  if (isPending) {
    return <div className="h-10 w-16 rounded-lg bg-muted" aria-hidden="true" />
  }

  if (!session?.user) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-10"
        onClick={() => openLogin()}
      >
        Login
      </Button>
    )
  }

  const { user } = session
  const label = user.email || user.name || "Account"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={label}
            className="h-10 max-w-44 gap-2 px-2"
          />
        }
      >
        <Avatar size="sm">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>
            {accountInitial(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden truncate sm:inline">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
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
