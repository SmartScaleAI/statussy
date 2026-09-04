"use server"

import { headers } from "next/headers"

import { describeDatabaseTarget, getDatabasePool } from "@/lib/db"
import { parseSuggestionInput } from "@/lib/suggest-provider"

export type SuggestProviderState = {
  status: "idle" | "success" | "error"
  message: string
  fieldErrors?: {
    name?: string
    email?: string
  }
}

export const initialSuggestProviderState: SuggestProviderState = {
  status: "idle",
  message: "",
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const SLACK_TIMEOUT_MS = 5_000

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

async function notifySlack(payload: {
  name: string
  email: string | null
  createdAt: Date
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn(
      "[statussy] SLACK_WEBHOOK_URL is not set — suggestion stored without Slack notify"
    )
    return
  }

  const text = [
    "New provider suggestion",
    `Name: ${payload.name}`,
    payload.email ? `Email: ${payload.email}` : "Email: (none)",
    `Submitted: ${payload.createdAt.toISOString()}`,
  ].join("\n")

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error(
        "[statussy] Slack suggestion notify failed",
        res.status,
        await res.text()
      )
    }
  } catch (err) {
    console.error("[statussy] Slack suggestion notify failed", err)
  }
}

export async function suggestProvider(
  _prev: SuggestProviderState,
  formData: FormData
): Promise<SuggestProviderState> {
  if (isHoneypotTripped(formData)) {
    return {
      status: "success",
      message: "Thanks — we received your suggestion.",
    }
  }

  if (isRateLimited(await clientKey())) {
    return {
      status: "error",
      message: "Too many suggestions. Try again in a few minutes.",
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

  const pool = getDatabasePool()
  if (!pool) {
    return {
      status: "error",
      message: "Suggestions are unavailable right now.",
    }
  }

  try {
    const { rows } = await pool.query<{ created_at: Date }>(
      `INSERT INTO provider_suggestions (name, email)
       VALUES ($1, $2)
       RETURNING created_at`,
      [parsed.name, parsed.email]
    )
    const createdAt = rows[0]?.created_at ?? new Date()
    await notifySlack({
      name: parsed.name,
      email: parsed.email,
      createdAt,
    })
    return {
      status: "success",
      message: "Thanks — we received your suggestion.",
    }
  } catch (err) {
    console.error(
      `[statussy] provider suggestion insert failed (db=${describeDatabaseTarget()})`,
      err
    )
    return {
      status: "error",
      message: "Could not save that suggestion. Try again in a moment.",
    }
  }
}
