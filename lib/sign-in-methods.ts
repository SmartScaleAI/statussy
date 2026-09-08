/**
 * Google / GitHub connect-unlink helpers (SMA-108).
 * Magic-link is the email itself (no `account` row), so last-method is
 * the last remaining *linked OAuth* provider. Disconnecting that would
 * lock out Google-only / GitHub-only users who do not treat magic-link
 * as a second method.
 */

/** Board query that opens the Sign In dialog (signed-out `/settings`). */
export const SIGN_IN_QUERY = "signin"

export const SOCIAL_PROVIDERS = ["google", "github"] as const

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

export type LinkedAccount = {
  id: string
  providerId: string
}

export function isSocialProvider(value: string): value is SocialProvider {
  return value === "google" || value === "github"
}

export function connectedSocialProviders(
  accounts: ReadonlyArray<Pick<LinkedAccount, "providerId">>
): Set<SocialProvider> {
  const connected = new Set<SocialProvider>()
  for (const account of accounts) {
    if (isSocialProvider(account.providerId)) {
      connected.add(account.providerId)
    }
  }
  return connected
}

/** First character of the email, uppercase — letter avatar fallback. */
export function emailAvatarLetter(email: string): string {
  const trimmed = email.trim()
  const first = trimmed[0]
  return first ? first.toUpperCase() : "?"
}

/**
 * Disconnect is allowed only when another OAuth provider stays linked.
 * Magic-link-only users have nothing to unlink.
 */
export function canUnlinkSocialProvider(
  accounts: ReadonlyArray<Pick<LinkedAccount, "providerId">>,
  provider: SocialProvider
): boolean {
  const connected = connectedSocialProviders(accounts)
  if (!connected.has(provider)) {
    return false
  }
  return connected.size > 1
}

export const LAST_METHOD_COPY =
  "This is your only remaining sign-in method. Connect another account before disconnecting so you are not locked out."
