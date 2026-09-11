/**
 * Outbound HTTPS webhook alerts (SMA-137).
 *
 * Slack Incoming Webhook URLs and any public HTTPS endpoint. One batched
 * POST per poll. HMAC in X-Statussy-Signature. Auto-disable after 3 hard
 * failures. Mute-until-Live is shared with email (digest_episode_mutes).
 */
import { createHmac, randomBytes } from "node:crypto"
import type pg from "pg"

import { digestServiceUrl } from "./digest-email.js"
import type { ServiceStatus } from "./statuspage.js"

export type WebhookTransition = {
  serviceId: string
  name: string
  from: ServiceStatus
  to: ServiceStatus
  statusUrl?: string
  checkedAt?: string
}

export const WEBHOOK_SIGNATURE_HEADER = "X-Statussy-Signature"
export const WEBHOOK_HARD_FAILURE_LIMIT = 3
export const WEBHOOK_TIMEOUT_MS = 4_000
export const WEBHOOK_MAX_ATTEMPTS = 3
export const WEBHOOK_DISABLED_REASON_FAILURES = "hard_failures"

export const WEBHOOK_STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: "Live",
  degraded: "Degraded",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
  unknown: "Unknown",
}

export type WebhookServiceAlert = {
  serviceId: string
  name: string
  fromStatus: ServiceStatus
  toStatus: ServiceStatus
  checkedAt: string
  officialStatusUrl: string | null
  statussyUrl: string
}

export type WebhookPayload = {
  text: string
  services: WebhookServiceAlert[]
}

export type WebhookUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export type WebhookDeliveryResult =
  | { ok: true; status: number }
  | { ok: false; error: string; status?: number }

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
])

export function generateWebhookSecret(): string {
  return `stsy_${randomBytes(32).toString("base64url")}`
}

export function isBlockedWebhookHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(hostname.toLowerCase())) {
    return true
  }
  if (host.endsWith(".localhost") || host.endsWith(".local")) {
    return true
  }
  if (host.startsWith("127.") || host.startsWith("10.")) {
    return true
  }
  if (host.startsWith("192.168.") || host.startsWith("169.254.")) {
    return true
  }
  const match = /^172\.(\d+)\./.exec(host)
  if (match) {
    const second = Number(match[1])
    if (second >= 16 && second <= 31) {
      return true
    }
  }
  if (
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  ) {
    return true
  }
  return false
}

export function parseWebhookUrl(raw: string): WebhookUrlResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: "Enter an HTTPS webhook URL." }
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: "Enter a valid HTTPS URL." }
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Webhook URL must be HTTPS." }
  }
  if (isBlockedWebhookHost(parsed.hostname)) {
    return { ok: false, error: "Webhook URL must be a public HTTPS endpoint." }
  }
  return { ok: true, url: parsed.href }
}

export function safeOfficialStatusUrl(
  value: string | undefined | null
): string | null {
  if (!value) {
    return null
  }
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }
    return url.href
  } catch {
    return null
  }
}

export function webhookTextSummary(
  services: readonly WebhookServiceAlert[]
): string {
  if (services.length === 1) {
    const item = services[0]
    return `Statussy: ${item.name} flipped to ${WEBHOOK_STATUS_LABEL[item.toStatus]}`
  }
  if (services.length <= 3) {
    return `Statussy: ${services
      .map(
        (item) => `${item.name} (${WEBHOOK_STATUS_LABEL[item.toStatus]})`
      )
      .join(", ")}`
  }
  return `Statussy: ${services.length} services in your stack need attention`
}

export function buildWebhookServices(
  items: readonly WebhookTransition[],
  publicSiteUrl: string,
  checkedAt: string
): WebhookServiceAlert[] {
  return items.map((item) => ({
    serviceId: item.serviceId,
    name: item.name,
    fromStatus: item.from,
    toStatus: item.to,
    checkedAt: item.checkedAt ?? checkedAt,
    officialStatusUrl: safeOfficialStatusUrl(item.statusUrl),
    statussyUrl: digestServiceUrl(publicSiteUrl, item.serviceId),
  }))
}

export function buildWebhookPayload(
  services: readonly WebhookServiceAlert[]
): WebhookPayload {
  return {
    text: webhookTextSummary(services),
    services: [...services],
  }
}

export function serializeWebhookPayload(payload: WebhookPayload): string {
  return JSON.stringify({
    text: payload.text,
    services: payload.services.map((item) => ({
      serviceId: item.serviceId,
      name: item.name,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      checkedAt: item.checkedAt,
      officialStatusUrl: item.officialStatusUrl,
      statussyUrl: item.statussyUrl,
    })),
  })
}

export function signWebhookBody(secret: string, body: string): string {
  const hex = createHmac("sha256", secret).update(body).digest("hex")
  return `sha256=${hex}`
}

export function isRetryableWebhookStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

export function applyWebhookFailure(consecutiveFailures: number): {
  consecutiveFailures: number
  enabled: boolean
  disabledReason: typeof WEBHOOK_DISABLED_REASON_FAILURES | null
} {
  const next = consecutiveFailures + 1
  if (next >= WEBHOOK_HARD_FAILURE_LIMIT) {
    return {
      consecutiveFailures: next,
      enabled: false,
      disabledReason: WEBHOOK_DISABLED_REASON_FAILURES,
    }
  }
  return {
    consecutiveFailures: next,
    enabled: true,
    disabledReason: null,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function deliverWebhook(input: {
  url: string
  secret: string
  body: string
  timeoutMs?: number
  maxAttempts?: number
  fetchImpl?: typeof fetch
}): Promise<WebhookDeliveryResult> {
  const parsed = parseWebhookUrl(input.url)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }
  const timeoutMs = input.timeoutMs ?? WEBHOOK_TIMEOUT_MS
  const maxAttempts = input.maxAttempts ?? WEBHOOK_MAX_ATTEMPTS
  const fetchImpl = input.fetchImpl ?? fetch
  const signature = signWebhookBody(input.secret, input.body)
  let lastError = "Webhook delivery failed."
  let lastStatus: number | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(parsed.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/plain, */*",
          "user-agent": "statussy-webhook/0.1 (+https://www.statussy.com)",
          [WEBHOOK_SIGNATURE_HEADER]: signature,
        },
        body: input.body,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      })
      lastStatus = response.status
      if (response.ok) {
        await response.arrayBuffer().catch(() => undefined)
        return { ok: true, status: response.status }
      }
      const snippet = (await response.text().catch(() => "")).slice(0, 180)
      lastError = snippet
        ? `HTTP ${response.status}: ${snippet}`
        : `HTTP ${response.status}`
      if (!isRetryableWebhookStatus(response.status) || attempt === maxAttempts) {
        return { ok: false, error: lastError, status: response.status }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error"
      lastError = message
      lastStatus = undefined
      if (attempt === maxAttempts) {
        return { ok: false, error: lastError }
      }
    }
    await sleep(150 * attempt)
  }
  return { ok: false, error: lastError, status: lastStatus }
}

export async function claimWebhookSend(
  pool: pg.Pool,
  userId: string,
  pollId: string,
  serviceCount: number
): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO webhook_sends (user_id, poll_id, service_count)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, poll_id) DO NOTHING`,
    [userId, pollId, serviceCount]
  )
  return (result.rowCount ?? 0) > 0
}

export async function releaseWebhookSend(
  pool: pg.Pool,
  userId: string,
  pollId: string
): Promise<void> {
  await pool.query(
    `DELETE FROM webhook_sends WHERE user_id = $1 AND poll_id = $2`,
    [userId, pollId]
  )
}

export async function recordWebhookSuccess(
  pool: pg.Pool,
  userId: string
): Promise<void> {
  await pool.query(
    `UPDATE user_webhook_prefs
        SET consecutive_failures = 0,
            last_error = NULL,
            last_success_at = now(),
            updated_at = now()
      WHERE user_id = $1`,
    [userId]
  )
}

export async function recordWebhookFailure(
  pool: pg.Pool,
  userId: string,
  error: string
): Promise<{ disabled: boolean }> {
  const { rows } = await pool.query<{ consecutive_failures: number }>(
    `SELECT consecutive_failures
       FROM user_webhook_prefs
      WHERE user_id = $1`,
    [userId]
  )
  const current = rows[0]?.consecutive_failures ?? 0
  const next = applyWebhookFailure(current)
  await pool.query(
    `UPDATE user_webhook_prefs
        SET consecutive_failures = $2,
            last_error = $3,
            enabled = CASE WHEN $4 THEN false ELSE enabled END,
            disabled_reason = CASE WHEN $4 THEN $5 ELSE disabled_reason END,
            updated_at = now()
      WHERE user_id = $1`,
    [
      userId,
      next.consecutiveFailures,
      error.slice(0, 240),
      !next.enabled,
      next.disabledReason,
    ]
  )
  return { disabled: !next.enabled }
}
