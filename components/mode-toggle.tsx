"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"

const THEME_VALUES = ["light", "dark", "system"] as const

type ThemeValue = (typeof THEME_VALUES)[number]

const THEME_LABEL: Record<ThemeValue, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
}

const THEME_ICON: Record<ThemeValue, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
}

function isThemeValue(value: string): value is ThemeValue {
  return (THEME_VALUES as readonly string[]).includes(value)
}

/** Header icon toggle — signed-out chrome only (no profile menu). */
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      className="size-10 text-foreground"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  )
}

/**
 * Profile-menu Theme submenu (Linear / Vercel / GitHub pattern):
 * Light, Dark, System with a check on the saved preference.
 */
export function ThemeMenuSub() {
  const { theme, setTheme } = useTheme()
  const current = theme && isThemeValue(theme) ? theme : "system"

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
      <DropdownMenuSubContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={current}
            onValueChange={(value) => {
              if (typeof value === "string" && isThemeValue(value)) {
                setTheme(value)
              }
            }}
          >
            {THEME_VALUES.map((value) => {
              const Icon = THEME_ICON[value]
              return (
                <DropdownMenuRadioItem key={value} value={value} closeOnClick>
                  <Icon />
                  {THEME_LABEL[value]}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
