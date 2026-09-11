/**
 * Outbound webhook payload, HMAC, URL checks, and delivery (SMA-137).
 * Client-safe except deliverWebhook (uses fetch). No Postgres imports.
 */

import { createHmac, randomBytes } from "node:crypto"

export const WEBHOOK_SIGNATURE_HEADER = "X-Statussy-Signature"
export const WEBHOOK_HARD_FAILURE_LIMIT = 3
export const WEBHOOK_TIMEOUT_MS = 4_000
export const WEBHOOK_MAX_ATTEMPTS = 3
export const WEBHOOK_DISABLED_REASON_FAILURES = "hard_failures"

export const STATUS_LABEL: Record<string, string> = {
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
  fromStatus: string
  toStatus: string
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

export function maskWebhookSecret(secret: string): string {
  const trimmed = secret.trim()
  if (trimmed.length < 10) {
    return "••••••••"
  }
  return `${trimmed.slice(0, 5)}…${trimmed.slice(-4)}`
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

export function siteOrigin(publicSiteUrl: string): string {
  return publicSiteUrl.replace(/\/$/, "") || "https://www.statussy.com"
}

export function statussyServiceUrl(
  publicSiteUrl: string,
  serviceId: string
): string {
  return `${siteOrigin(publicSiteUrl)}/services/${serviceId}`
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

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

export function webhookTextSummary(
  services: readonly WebhookServiceAlert[]
): string {
  if (services.length === 1) {
    const item = services[0]
    return `Statussy: ${item.name} flipped to ${statusLabel(item.toStatus)}`
  }
  if (services.length <= 3) {
    return `Statussy: ${services
      .map((item) => `${item.name} (${statusLabel(item.toStatus)})`)
      .join(", ")}`
  }
  return `Statussy: ${services.length} services in your stack need attention`
}

export function buildWebhookServices(
  items: ReadonlyArray<{
    serviceId: string
    name: string
    from: string
    to: string
    statusUrl?: string
    checkedAt?: string
  }>,
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
    statussyUrl: statussyServiceUrl(publicSiteUrl, item.serviceId),
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

export function testWebhookServices(
  publicSiteUrl: string,
  checkedAt: string
): WebhookServiceAlert[] {
  const origin = siteOrigin(publicSiteUrl)
  return [
    {
      serviceId: "statussy-test",
      name: "Statussy test",
      fromStatus: "operational",
      toStatus: "major_outage",
      checkedAt,
      officialStatusUrl: null,
      statussyUrl: `${origin}/settings`,
    },
  ]
}

export function webhookDisabledNote(
  disabledReason: string | null,
  lastError: string | null
): string | null {
  if (disabledReason !== WEBHOOK_DISABLED_REASON_FAILURES) {
    return null
  }
  const base =
    "Webhook alerts were turned off after 3 failed deliveries. Update the URL if it changed, then turn Enable webhook back on."
  const error = lastError?.trim()
  return error ? `${base} Last error: ${error}` : base
}
