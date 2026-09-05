import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Frosted paper sheet for board sections over the pixel-star background. */
export const boardPaperClassName =
  "rounded-2xl border border-black/10 bg-[color-mix(in_srgb,var(--bg-footer)_70%,transparent)] px-5 py-6 shadow-[var(--card-shadow)] backdrop-blur-md backdrop-saturate-150 sm:px-7 sm:py-8 dark:border-white/10"
