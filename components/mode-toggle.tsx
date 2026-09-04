"use client"

import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={
        !mounted
          ? "Toggle theme"
          : resolvedTheme === "dark"
            ? "Switch to light mode"
            : "Switch to dark mode"
      }
      onClick={() => {
        if (!mounted || !resolvedTheme) {
          return
        }
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
