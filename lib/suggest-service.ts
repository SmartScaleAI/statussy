export const MAX_NAME_LENGTH = 120
export const MAX_EMAIL_LENGTH = 254

const SLACK_TIMEOUT_MS = 5_000

/** Light email check — reject obviously invalid values, allow omitting email. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SuggestionFieldErrors = {
  name?: string
  email?: string
}

export type ParsedSuggestion =
  | { ok: true; name: string; email: string | null }
  | { ok: false; fieldErrors: SuggestionFieldErrors; message: string }

export type SuggestServiceState = {
  status: "idle" | "success" | "error"
  message: string
  fieldErrors?: {
    name?: string
    email?: string
  }
}

export const initialSuggestServiceState: SuggestServiceState = {
  status: "idle",
  message: "",
}

export const SUGGEST_SUCCESS_MESSAGE = "Thanks — we received your suggestion."
export const SUGGEST_UNAVAILABLE_MESSAGE =
  "Suggestions are unavailable right now."
export const SUGGEST_SAVE_FAILED_MESSAGE =
  "Could not save that suggestion. Try again in a moment."
export const SUGGEST_RATE_LIMIT_MESSAGE =
  "Too many suggestions. Try again in a few minutes."

export function parseSuggestionInput(input: {
  name: unknown
  email: unknown
}): ParsedSuggestion {
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const emailRaw = typeof input.email === "string" ? input.email.trim() : ""

  const fieldErrors: SuggestionFieldErrors = {}

  if (!name) {
    fieldErrors.name = "Service name is required."
  } else if (name.length > MAX_NAME_LENGTH) {
    fieldErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`
  }

  let email: string | null = null
  if (emailRaw) {
    if (emailRaw.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(emailRaw)) {
      fieldErrors.email = "Enter a valid email, or leave it blank."
    } else {
      email = emailRaw
    }
  }

  if (fieldErrors.name || fieldErrors.email) {
    return {
      ok: false,
      fieldErrors,
      message:
        fieldErrors.name ??
        fieldErrors.email ??
        "Check the form and try again.",
    }
  }

  return { ok: true, name, email }
}

/** Coerce pg `timestamptz` (Date or string) so Slack text never throws. */
export function toSuggestionTimestamp(
  value: unknown,
  fallback = () => new Date()
): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return fallback()
}

export function formatSuggestionIso(value: unknown): string {
  try {
    return toSuggestionTimestamp(value).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

export type SlackNotifyResult = "skipped" | "sent" | "failed"

export type SlackNotifyDeps = {
  webhookUrl?: string | null
  fetchImpl?: typeof fetch
  log?: Pick<Console, "warn" | "error">
}

/**
 * Slack is best-effort. A missing webhook or a failed post must never fail
 * the suggestion save (SMA-30).
 */
export async function notifySlackSuggestion(
  payload: {
    name: string
    email: string | null
    createdAt: unknown
  },
  deps: SlackNotifyDeps = {}
): Promise<SlackNotifyResult> {
  const log = deps.log ?? console
  const webhookUrl =
    deps.webhookUrl !== undefined
      ? deps.webhookUrl
      : process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    log.warn(
      "[statussy] SLACK_WEBHOOK_URL is not set — suggestion stored without Slack notify"
    )
    return "skipped"
  }

  const text = [
    "New service suggestion",
    `Name: ${payload.name}`,
    payload.email ? `Email: ${payload.email}` : "Email: (none)",
    `Submitted: ${formatSuggestionIso(payload.createdAt)}`,
  ].join("\n")

  try {
    const fetchImpl = deps.fetchImpl ?? fetch
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    })
    if (!res.ok) {
      log.error(
        "[statussy] Slack suggestion notify failed",
        res.status,
        await res.text().catch(() => "")
      )
      return "failed"
    }
    return "sent"
  } catch (err) {
    log.error("[statussy] Slack suggestion notify failed", err)
    return "failed"
  }
}
