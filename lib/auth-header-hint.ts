/**
 * Header chrome first paint (SMA-147).
 *
 * Better Auth's session_token is httpOnly, so the ISR homepage cannot read
 * it without cookies() — and cookies() would dynamize `/`. A JS-readable
 * hint cookie plus a blocking script let Sign In vs avatar match the common
 * signed-in case on first paint. Presence only; never a verified session.
 */

export const AUTH_HEADER_HINT_KEY = "statussy:authHint"

export const AUTH_HEADER_HINT_VALUE = "1"

export const AUTH_HEADER_HINT_ATTR = "data-auth-hint"

export const AUTH_HEADER_HINT_SIGNED_IN = "signed-in"

/** One year — same lifetime as `statussy:boardTab`. Cleared on sign-out. */
export const AUTH_HEADER_HINT_MAX_AGE = 60 * 60 * 24 * 365

export type AuthHeaderSessionStatus = "pending" | "signed-in" | "signed-out"

export type AuthHeaderChrome = "signed-in" | "signed-out"

export type AuthHeaderChromeMount = "both" | AuthHeaderChrome

/**
 * Pending session honors the hint so refresh does not paint Sign In while
 * Better Auth is still resolving. Confirmed session always wins.
 */
export function resolveAuthHeaderChrome(input: {
  sessionStatus: AuthHeaderSessionStatus
  hasHint: boolean
}): AuthHeaderChrome {
  if (input.sessionStatus === "signed-in") {
    return "signed-in"
  }
  if (input.sessionStatus === "signed-out") {
    return "signed-out"
  }
  return input.hasHint ? "signed-in" : "signed-out"
}

/**
 * Dual chrome is only for pending / first paint (cached HTML + hint CSS).
 * Settled session mounts a single chrome so Sign In cannot stay visible
 * beside the avatar when Tailwind `flex` beats `display: none`.
 */
export function resolveAuthHeaderChromeMount(
  sessionStatus: AuthHeaderSessionStatus
): AuthHeaderChromeMount {
  if (sessionStatus === "pending") {
    return "both"
  }
  return sessionStatus
}

/**
 * Better Auth may report `isPending=false` with no session before the
 * first fetch starts. Treat that as pending until pending has been seen,
 * matching AuthProvider's hint sync.
 */
export function resolveAuthHeaderSessionStatus(input: {
  isPending: boolean
  hasSession: boolean
  seenPending: boolean
}): AuthHeaderSessionStatus {
  if (input.hasSession) {
    return "signed-in"
  }
  if (input.isPending || !input.seenPending) {
    return "pending"
  }
  return "signed-out"
}

/**
 * Read `statussy:authHint=1` from a Cookie header or `document.cookie`.
 */
export function parseAuthHeaderHintCookieHeader(
  cookieHeader: string | null | undefined
): boolean {
  if (!cookieHeader) {
    return false
  }
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf("=")
    if (eq === -1) {
      continue
    }
    const name = trimmed.slice(0, eq).trim()
    if (name !== AUTH_HEADER_HINT_KEY) {
      continue
    }
    try {
      return (
        decodeURIComponent(trimmed.slice(eq + 1)) === AUTH_HEADER_HINT_VALUE
      )
    } catch {
      return false
    }
  }
  return false
}

export function readDocumentAuthHeaderHint(): boolean {
  if (typeof document === "undefined") {
    return false
  }
  return parseAuthHeaderHintCookieHeader(document.cookie)
}

function cookieSecureSuffix(): string {
  return typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; Secure"
    : ""
}

export function writeAuthHeaderHint(): void {
  if (typeof document === "undefined") {
    return
  }
  document.cookie = `${AUTH_HEADER_HINT_KEY}=${AUTH_HEADER_HINT_VALUE}; Path=/; Max-Age=${AUTH_HEADER_HINT_MAX_AGE}; SameSite=Lax${cookieSecureSuffix()}`
}

export function clearAuthHeaderHint(): void {
  if (typeof document === "undefined") {
    return
  }
  document.cookie = `${AUTH_HEADER_HINT_KEY}=; Path=/; Max-Age=0; SameSite=Lax${cookieSecureSuffix()}`
}

export function applyAuthHeaderHintDocument(hasHint: boolean): void {
  if (typeof document === "undefined") {
    return
  }
  if (hasHint) {
    document.documentElement.setAttribute(
      AUTH_HEADER_HINT_ATTR,
      AUTH_HEADER_HINT_SIGNED_IN
    )
    return
  }
  document.documentElement.removeAttribute(AUTH_HEADER_HINT_ATTR)
}

/**
 * Runs in `<head>` before first paint (next-themes pattern). Sets
 * `data-auth-hint="signed-in"` when the hint cookie is present so the
 * cached Sign In HTML is hidden and the avatar chrome shows.
 */
export const AUTH_HEADER_HINT_SCRIPT = `(function(){try{var c=document.cookie;var parts=c.split(";");for(var i=0;i<parts.length;i++){var p=parts[i].trim();var eq=p.indexOf("=");if(eq===-1)continue;if(p.slice(0,eq).trim()!=="${AUTH_HEADER_HINT_KEY}")continue;if(decodeURIComponent(p.slice(eq+1))==="${AUTH_HEADER_HINT_VALUE}"){document.documentElement.setAttribute("${AUTH_HEADER_HINT_ATTR}","${AUTH_HEADER_HINT_SIGNED_IN}");}break;}}catch(e){}})();`

/**
 * Keep the document attribute and hint cookie aligned with a settled
 * session. No-ops while Better Auth is still pending.
 */
export function syncAuthHeaderHintFromSession(input: {
  sessionStatus: AuthHeaderSessionStatus
}): void {
  if (input.sessionStatus === "pending") {
    applyAuthHeaderHintDocument(readDocumentAuthHeaderHint())
    return
  }
  const signedIn = input.sessionStatus === "signed-in"
  if (signedIn) {
    writeAuthHeaderHint()
  } else {
    clearAuthHeaderHint()
  }
  applyAuthHeaderHintDocument(signedIn)
}
