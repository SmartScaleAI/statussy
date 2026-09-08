/**
 * Resend config + error copy for Better Auth magic-link (SMA-110).
 * Env values stay out of this module — callers pass process.env.
 */

export type ResendConfig =
  | { ok: true; apiKey: string; from: string }
  | { ok: false; missing: string[] }

/** Canonical Production names. `RESEND_FROM_EMAIL` is accepted as an alias. */
export function resolveResendConfig(
  env: NodeJS.ProcessEnv = process.env
): ResendConfig {
  const apiKey = env.RESEND_API_KEY?.trim() ?? ""
  const from = (env.RESEND_FROM ?? env.RESEND_FROM_EMAIL)?.trim() ?? ""
  const missing: string[] = []
  if (!apiKey) {
    missing.push("RESEND_API_KEY")
  }
  if (!from) {
    missing.push("RESEND_FROM")
  }
  if (missing.length > 0) {
    return { ok: false, missing }
  }
  return { ok: true, apiKey, from }
}

export function resendConfigErrorMessage(missing: readonly string[]): string {
  return `Email sign-in is not configured. Set ${missing.join(" and ")} on Vercel Production.`
}

export function resendDeliveryErrorMessage(resendMessage: string): string {
  const trimmed = resendMessage.trim()
  const lower = trimmed.toLowerCase()
  if (
    lower.includes("not verified") ||
    lower.includes("domain") ||
    lower.includes("from address") ||
    lower.includes("invalid `from`")
  ) {
    return `Could not send a sign-in link (${trimmed}). Verify the RESEND_FROM domain in Resend.`
  }
  if (!trimmed) {
    return "Could not send a sign-in link. Check Vercel logs and Resend."
  }
  return `Could not send a sign-in link (${trimmed}).`
}

export function publicAuthFailureMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = String((err as { message: unknown }).message ?? "").trim()
    if (message.startsWith("Email sign-in is not configured")) {
      return message
    }
    if (message.startsWith("Could not send a sign-in link")) {
      return message
    }
    if (message.includes("RESEND_")) {
      return resendConfigErrorMessage(["RESEND_API_KEY", "RESEND_FROM"])
    }
  }
  return "Could not send a sign-in link. Check Vercel function logs."
}
