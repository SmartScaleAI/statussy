"use client"

import { useTheme } from "next-themes"

import { BackgroundPixelStars } from "@/components/ui/background-pixel-stars"
import { cn } from "@/lib/utils"

export function SiteBackground() {
  const { resolvedTheme } = useTheme()
  const scheme = resolvedTheme === "light" ? "light" : "dark"

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-0 bg-[size:10px]",
        "bg-[#f4f4f5] bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVR42mO4cuXK/y9fvpKNGSjRPGrAqAGjBgwmAwC/PtvNZHkrRQAAAABJRU5ErkJggg==')]",
        "dark:bg-black dark:bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIElEQVR42mIUEhJiwAbevXuHVZyJgUQwqmEUDB0AEGAADd8DEPTX6ksAAAAASUVORK5CYII=')]"
      )}
    >
      <BackgroundPixelStars key={scheme} scheme={scheme} />
    </div>
  )
}
