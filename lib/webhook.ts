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
export const WEBHOOK_EVENT_TYPE_ALERT = "stack.alert"
export const WEBHOOK_EVENT_TYPE_TEST = "webhook.test"

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
  incidentTitle: string | null
  incidentUrl: string | null
}

export type WebhookEventType =
  | typeof WEBHOOK_EVENT_TYPE_ALERT
  | typeof WEBHOOK_EVENT_TYPE_TEST

export type WebhookPayloadData = {
  text: string
  boardUrl: string
  services: WebhookServiceAlert[]
}

export type WebhookPayload = {
  id: string
  type: WebhookEventType
  createdAt: string
  /** Top-level so Incoming Webhooks that require `text` (and return no_text otherwise) can render. */
  text: string
  data: WebhookPayloadData
}

export type WebhookPayloadOptions = {
  type?: WebhookEventType
  createdAt?: string
  id?: string
}

export type WebhookUrlResult =
  { ok: true; url: string } | { ok: false; error: string }

export type WebhookDeliveryResult =
  { ok: true; status: number } | { ok: false; error: string; status?: number }

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

export function generateWebhookEventId(): string {
  return `evt_${randomBytes(16).toString("hex")}`
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

export function webhookServiceLine(item: WebhookServiceAlert): string {
  return `${item.name} (${statusLabel(item.toStatus)})`
}

export function webhookTextSummary(
  services: readonly WebhookServiceAlert[]
): string {
  return services
    .map((item) => {
      const incident = item.incidentTitle?.trim()
      if (incident) {
        return `${webhookServiceLine(item)}\n${incident}`
      }
      return webhookServiceLine(item)
    })
    .join("\n")
}

export function buildWebhookServices(
  items: ReadonlyArray<{
    serviceId: string
    name: string
    from: string
    to: string
    statusUrl?: string
    checkedAt?: string
    incidentTitle?: string
    incidentUrl?: string
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
    incidentTitle: item.incidentTitle?.trim() || null,
    incidentUrl: safeOfficialStatusUrl(item.incidentUrl),
  }))
}

export function buildWebhookPayload(
  services: readonly WebhookServiceAlert[],
  publicSiteUrl = "https://www.statussy.com",
  options: WebhookPayloadOptions = {}
): WebhookPayload {
  const text = webhookTextSummary(services)
  const boardUrl = siteOrigin(publicSiteUrl)
  return {
    id: options.id ?? generateWebhookEventId(),
    type: options.type ?? WEBHOOK_EVENT_TYPE_ALERT,
    createdAt: options.createdAt ?? new Date().toISOString(),
    text,
    data: {
      text,
      boardUrl,
      services: [...services],
    },
  }
}

function serializedServices(services: readonly WebhookServiceAlert[]) {
  return services.map((item) => ({
    serviceId: item.serviceId,
    name: item.name,
    fromStatus: item.fromStatus,
    toStatus: item.toStatus,
    checkedAt: item.checkedAt,
    officialStatusUrl: item.officialStatusUrl,
    statussyUrl: item.statussyUrl,
    incidentTitle: item.incidentTitle,
    incidentUrl: item.incidentUrl,
  }))
}

export function serializeWebhookPayload(payload: WebhookPayload): string {
  return JSON.stringify({
    id: payload.id,
    type: payload.type,
    createdAt: payload.createdAt,
    text: payload.text,
    data: {
      text: payload.data.text,
      boardUrl: payload.data.boardUrl,
      services: serializedServices(payload.data.services),
    },
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
      if (
        !isRetryableWebhookStatus(response.status) ||
        attempt === maxAttempts
      ) {
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

/** Same shape as a live Major + Partial batch so Send test previews real copy. */
export function testWebhookServices(
  publicSiteUrl: string,
  checkedAt: string
): WebhookServiceAlert[] {
  return buildWebhookServices(
    [
      {
        serviceId: "openai",
        name: "OpenAI",
        from: "operational",
        to: "major_outage",
        statusUrl: "https://status.openai.com/",
        checkedAt,
        incidentTitle: "API elevated errors",
        incidentUrl: "https://status.openai.com/incidents/abc",
      },
      {
        serviceId: "anthropic",
        name: "Anthropic",
        from: "operational",
        to: "partial_outage",
        statusUrl: "https://status.claude.com/",
        checkedAt,
      },
    ],
    publicSiteUrl,
    checkedAt
  )
}

export function buildTestWebhookPayload(
  publicSiteUrl: string,
  checkedAt: string
): WebhookPayload {
  return buildWebhookPayload(
    testWebhookServices(publicSiteUrl, checkedAt),
    publicSiteUrl,
    {
      type: WEBHOOK_EVENT_TYPE_TEST,
      createdAt: checkedAt,
    }
  )
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
