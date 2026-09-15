/**
 * Homepage My Stack | All Services tab (SMA-133 / SMA-143).
 *
 * Persistence is only for signed-in users with at least one favorite.
 * Signed-out and empty-stack visits always land on All Services.
 * Last tab is stored in localStorage and mirrored to a cookie so the
 * server can pick the first-paint tab on refresh.
 */

export const BOARD_TAB_KEY = "statussy:boardTab"

export const BOARD_TAB_VALUES = ["stack", "all"] as const

export type BoardTab = (typeof BOARD_TAB_VALUES)[number]

export const DEFAULT_BOARD_TAB: BoardTab = "all"

/** One year — last-tab cookie should survive across visits. */
export const BOARD_TAB_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

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

/**
 * Read `statussy:boardTab` from a Cookie header or `document.cookie`.
 */
export function parseBoardTabCookieHeader(
  cookieHeader: string | null | undefined
): BoardTab | null {
  if (!cookieHeader) {
    return null
  }
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf("=")
    if (eq === -1) {
      continue
    }
    const name = trimmed.slice(0, eq).trim()
    if (name !== BOARD_TAB_KEY) {
      continue
    }
    try {
      return parseBoardTab(decodeURIComponent(trimmed.slice(eq + 1)))
    } catch {
      return null
    }
  }
  return null
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

/**
 * SSR resolver. `favoriteCount` is null when Railway is unreachable —
 * honor a stored tab for signed-in users, otherwise All Services.
 */
export function resolveServerBoardTab(input: {
  signedIn: boolean
  favoriteCount: number | null
  stored: BoardTab | null
}): BoardTab {
  const favoriteCount =
    input.favoriteCount ?? (input.signedIn && input.stored ? 1 : 0)
  return resolveBoardTab({
    signedIn: input.signedIn,
    favoriteCount,
    stored: input.stored,
  })
}

function readDocumentBoardTabCookie(): BoardTab | null {
  if (typeof document === "undefined") {
    return null
  }
  return parseBoardTabCookieHeader(document.cookie)
}

function writeDocumentBoardTabCookie(tab: BoardTab | null): void {
  if (typeof document === "undefined") {
    return
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  if (tab == null) {
    document.cookie = `${BOARD_TAB_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    return
  }
  document.cookie = `${BOARD_TAB_KEY}=${encodeURIComponent(tab)}; Path=/; Max-Age=${BOARD_TAB_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

export function readStoredBoardTab(): BoardTab | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const stored = parseBoardTab(window.localStorage.getItem(BOARD_TAB_KEY))
    if (stored) {
      return stored
    }
  } catch {
    // Private mode / blocked storage: fall through to the cookie.
  }
  return readDocumentBoardTabCookie()
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
  writeDocumentBoardTabCookie(tab)
}

export function clearStoredBoardTab(): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.localStorage.removeItem(BOARD_TAB_KEY)
  } catch {
    // Private mode / blocked storage: still drop the cookie.
  }
  writeDocumentBoardTabCookie(null)
}
