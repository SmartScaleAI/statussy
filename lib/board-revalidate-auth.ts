import { timingSafeEqual } from "node:crypto"

/**
 * Compare the worker bearer to the row in `board_revalidate_secret`.
 * Unequal lengths fail closed; `timingSafeEqual` throws on a length mismatch.
 */
export function boardRevalidateSecretsMatch(
  provided: string,
  expected: string
): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length === 0 || a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}

export function bearerToken(authorization: string | null): string {
  if (!authorization) {
    return ""
  }
  const match = /^Bearer ([^\s]+)$/.exec(authorization)
  return match?.[1] ?? ""
}
