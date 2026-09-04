export const MAX_NAME_LENGTH = 120
export const MAX_EMAIL_LENGTH = 254

/** Light email check — reject obviously invalid values, allow omitting email. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SuggestionFieldErrors = {
  name?: string
  email?: string
}

export type ParsedSuggestion =
  | { ok: true; name: string; email: string | null }
  | { ok: false; fieldErrors: SuggestionFieldErrors; message: string }

export function parseSuggestionInput(input: {
  name: unknown
  email: unknown
}): ParsedSuggestion {
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const emailRaw = typeof input.email === "string" ? input.email.trim() : ""

  const fieldErrors: SuggestionFieldErrors = {}

  if (!name) {
    fieldErrors.name = "Provider name is required."
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
