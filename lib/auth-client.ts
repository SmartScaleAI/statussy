import { magicLinkClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
})

/** Path + query to return to after OAuth / magic-link (stay on this board). */
export function currentCallbackPath(): string {
  const { pathname, search } = window.location
  return `${pathname}${search}` || "/"
}
