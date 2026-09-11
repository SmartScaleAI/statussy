import {
  MAX_EMAIL_LENGTH,
  formatSuggestionIso,
  type SlackNotifyDeps,
  type SlackNotifyResult,
} from "./suggest-service.ts"

export const MAX_DESCRIPTION_LENGTH = 2000
export const MAX_SERVICE_LENGTH = 120

const SLACK_TIMEOUT_MS = 5_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const REPORT_KINDS = [
  "wrong_status",
  "wrong_info",
  "site_bug",
  "other",
] as const

export type ReportKind = (typeof REPORT_KINDS)[number]

export const FORM_KINDS = ["suggest_service", ...REPORT_KINDS] as const

export type FormKind = (typeof FORM_KINDS)[number]

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  wrong_status: "Wrong status",
  wrong_info: "Wrong logo / service info",
  site_bug: "Site bug",
  other: "Other",
}

export const FORM_KIND_LABELS: Record<FormKind, string> = {
  suggest_service: "Suggest a service",
  ...REPORT_KIND_LABELS,
}

export type ReportFieldErrors = {
  kind?: string
  description?: string
  service?: string
  email?: string
}

export type ParsedReport =
  | {
      ok: true
      kind: ReportKind
      description: string
      service: string | null
      email: string | null
    }
  | { ok: false; fieldErrors: ReportFieldErrors; message: string }

export type ReportSuggestState = {
  status: "idle" | "success" | "error"
  message: string
  fieldErrors?: {
    kind?: string
    name?: string
    description?: string
    service?: string
    email?: string
  }
}

export const initialReportSuggestState: ReportSuggestState = {
  status: "idle",
  message: "",
}

export const REPORT_SUCCESS_MESSAGE = "Thanks — we received your report."
export const REPORT_UNAVAILABLE_MESSAGE = "Reports are unavailable right now."
export const REPORT_SAVE_FAILED_MESSAGE =
  "Could not save that report. Try again in a moment."
export const REPORT_RATE_LIMIT_MESSAGE =
  "Too many submissions. Try again in a few minutes."

export function isFormKind(value: unknown): value is FormKind {
  return typeof value === "string" && FORM_KINDS.includes(value as FormKind)
}

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === "string" && REPORT_KINDS.includes(value as ReportKind)
}

function parseOptionalEmail(email: unknown): {
  email: string | null
  error?: string
} {
  const emailRaw = typeof email === "string" ? email.trim() : ""
  if (!emailRaw) {
    return { email: null }
  }
  if (emailRaw.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(emailRaw)) {
    return {
      email: null,
      error: "Enter a valid email, or leave it blank.",
    }
  }
  return { email: emailRaw }
}

export function parseReportInput(input: {
  kind: unknown
  description: unknown
  service: unknown
  email: unknown
}): ParsedReport {
  const fieldErrors: ReportFieldErrors = {}

  if (!isReportKind(input.kind)) {
    fieldErrors.kind = "Choose a report type."
  }

  const description =
    typeof input.description === "string" ? input.description.trim() : ""
  if (!description) {
    fieldErrors.description = "Description is required."
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`
  }

  const serviceRaw =
    typeof input.service === "string" ? input.service.trim() : ""
  let service: string | null = null
  if (serviceRaw) {
    if (serviceRaw.length > MAX_SERVICE_LENGTH) {
      fieldErrors.service = `Service must be ${MAX_SERVICE_LENGTH} characters or fewer.`
    } else {
      service = serviceRaw
    }
  }

  const parsedEmail = parseOptionalEmail(input.email)
  if (parsedEmail.error) {
    fieldErrors.email = parsedEmail.error
  }

  if (
    fieldErrors.kind ||
    fieldErrors.description ||
    fieldErrors.service ||
    fieldErrors.email
  ) {
    return {
      ok: false,
      fieldErrors,
      message:
        fieldErrors.kind ??
        fieldErrors.description ??
        fieldErrors.service ??
        fieldErrors.email ??
        "Check the form and try again.",
    }
  }

  return {
    ok: true,
    kind: input.kind as ReportKind,
    description,
    service,
    email: parsedEmail.email,
  }
}

/**
 * Slack is best-effort. A missing webhook or a failed post must never fail
 * the report save (same contract as SMA-28 / SMA-30).
 */
export async function notifySlackReport(
  payload: {
    kind: ReportKind
    description: string
    service: string | null
    email: string | null
    userId: string | null
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
      "[statussy] SLACK_WEBHOOK_URL is not set — report stored without Slack notify"
    )
    return "skipped"
  }

  const text = [
    "New user report",
    `Type: ${REPORT_KIND_LABELS[payload.kind]}`,
    `Description: ${payload.description}`,
    payload.service ? `Service: ${payload.service}` : "Service: (none)",
    payload.email ? `Email: ${payload.email}` : "Email: (none)",
    payload.userId ? `User: ${payload.userId}` : "User: (none)",
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
        "[statussy] Slack report notify failed",
        res.status,
        await res.text().catch(() => "")
      )
      return "failed"
    }
    return "sent"
  } catch (err) {
    log.error("[statussy] Slack report notify failed", err)
    return "failed"
  }
}
