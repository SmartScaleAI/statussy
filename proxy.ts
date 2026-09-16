import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  BOARD_TAB_KEY,
  hasAuthSessionCookieNames,
  parseBoardTab,
  resolveBoardProxyAction,
} from "@/lib/board-tab"

/**
 * SMA-145: cookie-only board tab at the network boundary (Next 16 proxy).
 * `/` and `/services` stay on shared 60s ISR All Services HTML. A Better
 * Auth session cookie plus `statussy:boardTab=stack` rewrites onto a second
 * ISR variant whose first HTML is already My Stack (loader only — no
 * private favorite ids). No session or favorites DB on the page.
 */
const BOARD_REWRITE_HEADER = "x-statussy-board-rewrite"

export function proxy(request: NextRequest) {
  // Rewrites must not bounce off the internal-path redirect if proxy
  // runs again on the destination.
  if (request.headers.get(BOARD_REWRITE_HEADER) === "1") {
    return NextResponse.next()
  }
  const action = resolveBoardProxyAction({
    pathname: request.nextUrl.pathname,
    hasSessionCookie: hasAuthSessionCookieNames(request.cookies.getAll()),
    stored: parseBoardTab(request.cookies.get(BOARD_TAB_KEY)?.value),
  })
  if (action.type === "next") {
    return NextResponse.next()
  }
  const url = request.nextUrl.clone()
  url.pathname = action.pathname
  if (action.type === "redirect") {
    return NextResponse.redirect(url)
  }
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(BOARD_REWRITE_HEADER, "1")
  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    "/",
    "/services",
    "/internal/board-stack",
    "/internal/board-stack/services",
  ],
}
