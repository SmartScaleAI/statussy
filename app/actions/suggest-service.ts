"use server"

import { headers } from "next/headers"
import { unstable_rethrow } from "next/navigation"

import { insertServiceSuggestion } from "@/lib/db"
import {
  SUGGEST_RATE_LIMIT_MESSAGE,
  SUGGEST_SAVE_FAILED_MESSAGE,
  SUGGEST_SUCCESS_MESSAGE,
  SUGGEST_UNAVAILABLE_MESSAGE,
  notifySlackSuggestion,
  parseSuggestionInput,
  type SuggestServiceState,
} from "@/lib/suggest-service"

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

async function runSuggestService(
  formData: FormData
): Promise<SuggestServiceState> {
  if (isHoneypotTripped(formData)) {
    return {
      status: "success",
      message: SUGGEST_SUCCESS_MESSAGE,
    }
  }

  if (isRateLimited(await clientKey())) {
    return {
      status: "error",
      message: SUGGEST_RATE_LIMIT_MESSAGE,
    }
  }

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

  const inserted = await insertServiceSuggestion(parsed.name, parsed.email)
  if (!inserted.ok) {
    return {
      status: "error",
      message: process.env.DATABASE_URL
        ? SUGGEST_SAVE_FAILED_MESSAGE
        : SUGGEST_UNAVAILABLE_MESSAGE,
    }
  }

  // Slack must never change the success response — save already succeeded.
  try {
    await notifySlackSuggestion({
      name: parsed.name,
      email: parsed.email,
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

export async function suggestService(
  _prev: SuggestServiceState,
  formData: FormData
): Promise<SuggestServiceState> {
  try {
    return await runSuggestService(formData)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] service suggestion action failed", err)
    return {
      status: "error",
      message: SUGGEST_SAVE_FAILED_MESSAGE,
    }
  }
}
