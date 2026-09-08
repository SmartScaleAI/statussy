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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function initialsFor(name: string, email: string) {
  const fromName = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
  if (fromName) {
    return fromName
  }
  return (email[0] ?? "?").toUpperCase()
}

function AccountMenu({
  name,
  email,
  image,
}: {
  name: string
  email: string
  image?: string | null
}) {
  const initials = initialsFor(name, email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={`Account menu for ${email}`}
            className="h-10 gap-2 px-2"
          />
        }
      >
        <Avatar size="sm">
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-36 truncate sm:inline">{email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate sm:hidden">
            {email}
          </DropdownMenuLabel>
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

export function AuthControls() {
  const { data: session, isPending } = authClient.useSession()
  const { openLogin } = useLoginDialog()

  if (isPending) {
    return <div className="h-10 w-16" aria-hidden="true" />
  }

  if (session?.user) {
    return (
      <AccountMenu
        name={session.user.name}
        email={session.user.email}
        image={session.user.image}
      />
    )
  }

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
