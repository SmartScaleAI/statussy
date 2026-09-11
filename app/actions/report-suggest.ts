"use server"

import { headers } from "next/headers"
import { unstable_rethrow } from "next/navigation"

import { insertServiceSuggestion, insertUserReport } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-session"
import {
  SUGGEST_SAVE_FAILED_MESSAGE,
  SUGGEST_SUCCESS_MESSAGE,
  SUGGEST_UNAVAILABLE_MESSAGE,
  notifySlackSuggestion,
  parseSuggestionInput,
} from "@/lib/suggest-service"
import {
  REPORT_RATE_LIMIT_MESSAGE,
  REPORT_SAVE_FAILED_MESSAGE,
  REPORT_SUCCESS_MESSAGE,
  REPORT_UNAVAILABLE_MESSAGE,
  isFormKind,
  notifySlackReport,
  parseReportInput,
  type ReportSuggestState,
} from "@/lib/user-report"

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5

const rateLimitHits = new Map<string, number[]>()

function pruneHits(now: number, hits: number[]) {
  return hits.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
}

function isRateLimited(key: string, now = Date.now()) {
  const hits = pruneHits(now, rateLimitHits.get(key) ?? [])
  if (hits.length >= RATE_LIMIT_MAX) {
    rateLimitHits.set(key, hits)
    return true
  }
  hits.push(now)
  rateLimitHits.set(key, hits)
  return false
}

async function clientKey() {
  const headerStore = await headers()
  const forwarded = headerStore.get("x-forwarded-for")
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("cf-connecting-ip")?.trim() ||
    "unknown"
  return ip
}

function isHoneypotTripped(formData: FormData) {
  const website = formData.get("website")
  return typeof website === "string" && website.trim().length > 0
}

function successMessageForKind(kind: string): string {
  return kind === "suggest_service"
    ? SUGGEST_SUCCESS_MESSAGE
    : REPORT_SUCCESS_MESSAGE
}

async function signedInIdentity(): Promise<{
  userId: string | null
  email: string | null
}> {
  const session = await getAuthSession()
  const userId =
    typeof session?.user?.id === "string" && session.user.id.trim()
      ? session.user.id.trim()
      : null
  const email =
    typeof session?.user?.email === "string" && session.user.email.trim()
      ? session.user.email.trim()
      : null
  return { userId, email }
}

async function runSuggest(formData: FormData): Promise<ReportSuggestState> {
  const parsed = parseSuggestionInput({
    name: formData.get("name"),
    email: formData.get("email"),
  })
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    }
  }

  const identity = await signedInIdentity()
  const email = parsed.email ?? identity.email

  const inserted = await insertServiceSuggestion(parsed.name, email)
  if (!inserted.ok) {
    return {
      status: "error",
      message: process.env.DATABASE_URL
        ? SUGGEST_SAVE_FAILED_MESSAGE
        : SUGGEST_UNAVAILABLE_MESSAGE,
    }
  }

  try {
    await notifySlackSuggestion({
      name: parsed.name,
      email,
      createdAt: inserted.createdAt,
    })
  } catch (err) {
    console.error("[statussy] Slack suggestion notify failed", err)
  }

  return {
    status: "success",
    message: SUGGEST_SUCCESS_MESSAGE,
  }
}

async function runReport(formData: FormData): Promise<ReportSuggestState> {
  const parsed = parseReportInput({
    kind: formData.get("kind"),
    description: formData.get("description"),
    service: formData.get("service"),
    email: formData.get("email"),
  })
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    }
  }

  const identity = await signedInIdentity()
  const email = parsed.email ?? identity.email

  const inserted = await insertUserReport({
    kind: parsed.kind,
    description: parsed.description,
    service: parsed.service,
    email,
    userId: identity.userId,
  })
  if (!inserted.ok) {
    return {
      status: "error",
      message: process.env.DATABASE_URL
        ? REPORT_SAVE_FAILED_MESSAGE
        : REPORT_UNAVAILABLE_MESSAGE,
    }
  }

  try {
    await notifySlackReport({
      kind: parsed.kind,
      description: parsed.description,
      service: parsed.service,
      email,
      userId: identity.userId,
      createdAt: inserted.createdAt,
    })
  } catch (err) {
    console.error("[statussy] Slack report notify failed", err)
  }

  return {
    status: "success",
    message: REPORT_SUCCESS_MESSAGE,
  }
}

async function runReportSuggest(
  formData: FormData
): Promise<ReportSuggestState> {
  const kindRaw = formData.get("kind")
  const kind = isFormKind(kindRaw) ? kindRaw : ""

  if (isHoneypotTripped(formData)) {
    return {
      status: "success",
      message: successMessageForKind(kind || "other"),
    }
  }

  if (isRateLimited(await clientKey())) {
    return {
      status: "error",
      message: REPORT_RATE_LIMIT_MESSAGE,
    }
  }

  if (!kind) {
    return {
      status: "error",
      message: "Choose a type.",
      fieldErrors: { kind: "Choose a type." },
    }
  }

  if (kind === "suggest_service") {
    return runSuggest(formData)
  }

  return runReport(formData)
}

export async function submitReportSuggest(
  _prev: ReportSuggestState,
  formData: FormData
): Promise<ReportSuggestState> {
  try {
    return await runReportSuggest(formData)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] report/suggest action failed", err)
    return {
      status: "error",
      message: REPORT_SAVE_FAILED_MESSAGE,
    }
  }
}
