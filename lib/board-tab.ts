/**
 * Homepage My Stack | All Services tab (SMA-133 / SMA-143 / SMA-145).
 *
 * Persistence is only for signed-in users with at least one favorite.
 * Signed-out and empty-stack visits always land on All Services.
 * Last tab is stored in localStorage and mirrored to a cookie so proxy
 * can pick a shared ISR HTML variant on refresh — no session/favorites
 * DB on the board page.
 */

export const BOARD_TAB_KEY = "statussy:boardTab"

export const BOARD_TAB_VALUES = ["stack", "all"] as const

export type BoardTab = (typeof BOARD_TAB_VALUES)[number]

export const DEFAULT_BOARD_TAB: BoardTab = "all"

/** One year — last-tab cookie should survive across visits. */
export const BOARD_TAB_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Internal ISR HTML for My Stack first paint (SMA-145). Public `/` and
 * `/services` stay on the All Services snapshot; proxy rewrites here when
 * a session cookie and `statussy:boardTab=stack` are both present. Not
 * linked; direct visits redirect back to the public URL.
 */
export const BOARD_STACK_PATH = "/internal/board-stack"

export const BOARD_STACK_SERVICES_PATH = "/internal/board-stack/services"

/**
 * Better Auth session_token names (default prefix, hyphen fallback, Secure
 * prefix, optional chunk suffix). Presence only — proxy never verifies.
 */
const AUTH_SESSION_COOKIE_RE =
  /^(?:__Secure-|__Host-)?better-auth[.-]session_token(?:\.|$)/

export function isAuthSessionCookieName(name: string): boolean {
  return AUTH_SESSION_COOKIE_RE.test(name)
}

export function hasAuthSessionCookieNames(
  names: readonly string[] | Iterable<{ name: string }>
): boolean {
  for (const entry of names) {
    const name = typeof entry === "string" ? entry : entry.name
    if (isAuthSessionCookieName(name)) {
      return true
    }
  }
  return false
}

export type BoardProxyAction =
  | { type: "next" }
  | { type: "rewrite"; pathname: string }
  | { type: "redirect"; pathname: string }

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1)
  }
  return pathname
}

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

/**
 * Cookie-only first paint (SMA-145). No session/favorites DB: honor the
 * stored tab only when a Better Auth session cookie is present. Missing
 * cookie → All Services (client locked-default still moves signed-in
 * stacks to My Stack after favorites settle).
 */
export function resolveCookieBoardTab(input: {
  hasSessionCookie: boolean
  stored: BoardTab | null
}): BoardTab {
  if (!input.hasSessionCookie) {
    return DEFAULT_BOARD_TAB
  }
  return input.stored ?? DEFAULT_BOARD_TAB
}

/**
 * Proxy routing for board ISR variants. Direct hits to the internal
 * stack paths redirect to the public URL. Session + stack cookie rewrites
 * `/` and `/services` onto those paths so first HTML is already My Stack.
 */
export function resolveBoardProxyAction(input: {
  pathname: string
  hasSessionCookie: boolean
  stored: BoardTab | null
}): BoardProxyAction {
  const pathname = normalizePathname(input.pathname)
  if (pathname === BOARD_STACK_PATH) {
    return { type: "redirect", pathname: "/" }
  }
  if (pathname === BOARD_STACK_SERVICES_PATH) {
    return { type: "redirect", pathname: "/services" }
  }
  if (pathname !== "/" && pathname !== "/services") {
    return { type: "next" }
  }
  const tab = resolveCookieBoardTab({
    hasSessionCookie: input.hasSessionCookie,
    stored: input.stored,
  })
  if (tab !== "stack") {
    return { type: "next" }
  }
  return {
    type: "rewrite",
    pathname:
      pathname === "/services" ? BOARD_STACK_SERVICES_PATH : BOARD_STACK_PATH,
  }
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
