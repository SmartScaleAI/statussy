/**
 * Homepage My Stack | All Services tab (SMA-133).
 *
 * Persistence is only for signed-in users with at least one favorite.
 * Signed-out and empty-stack visits always land on All Services.
 */

export const BOARD_TAB_KEY = "statussy:boardTab"

export const BOARD_TAB_VALUES = ["stack", "all"] as const

export type BoardTab = (typeof BOARD_TAB_VALUES)[number]

export const DEFAULT_BOARD_TAB: BoardTab = "all"

export function isBoardTab(value: unknown): value is BoardTab {
  return (
    typeof value === "string" &&
    (BOARD_TAB_VALUES as readonly string[]).includes(value)
  )
}

/** Invalid or missing storage → null (caller applies signed-in / empty rules). */
export function parseBoardTab(raw: string | null | undefined): BoardTab | null {
  return isBoardTab(raw) ? raw : null
}

export function shouldPersistBoardTab(input: {
  signedIn: boolean
  favoriteCount: number
}): boolean {
  return input.signedIn && input.favoriteCount >= 1
}

/**
 * Locked defaults (Colin + Avery + Mira 2026-09-10):
 * - Signed-out or empty My Stack → All Services
 * - Signed-in with ≥1 favorite → last stored tab, else My Stack
 */
export function resolveBoardTab(input: {
  signedIn: boolean
  favoriteCount: number
  stored: BoardTab | null
}): BoardTab {
  if (!shouldPersistBoardTab(input)) {
    return DEFAULT_BOARD_TAB
  }
  return input.stored ?? "stack"
}

export function readStoredBoardTab(): BoardTab | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return parseBoardTab(window.localStorage.getItem(BOARD_TAB_KEY))
  } catch {
    return null
  }
}

export function writeStoredBoardTab(tab: BoardTab): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.localStorage.setItem(BOARD_TAB_KEY, tab)
  } catch {
    // Private mode / quota: keep the last persisted value.
  }
}
