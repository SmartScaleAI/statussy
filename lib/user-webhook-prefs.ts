/**
 * Per-user outbound webhook prefs (SMA-137).
 * Always scoped by the Better Auth user id from the session.
 * Server-only (imports the Postgres pool).
 */

import { SITE_URL } from "./site-metadata.ts"
import {
  DEFAULT_WEBHOOK_PREFS,
  type UserWebhookPrefs,
} from "./webhook-prefs.ts"
import {
  applyWebhookFailure,
  deliverWebhook,
  generateWebhookSecret,
  maskWebhookSecret,
  parseWebhookUrl,
  serializeWebhookPayload,
  buildWebhookPayload,
  testWebhookServices,
  webhookDisabledNote,
  WEBHOOK_DISABLED_REASON_FAILURES,
} from "./webhook.ts"

export {
  DEFAULT_WEBHOOK_PREFS,
  pickWebhookPrefs,
  type UserWebhookPrefs,
} from "./webhook-prefs.ts"

type WebhookRow = {
  url: string | null
  enabled: boolean
  signing_secret: string
  consecutive_failures: number
  disabled_reason: string | null
  last_error: string | null
}

function mapRow(row: WebhookRow): UserWebhookPrefs {
  const secret = row.signing_secret.trim()
  return {
    url: row.url?.trim() ?? "",
    enabled: row.enabled,
    hasSecret: secret.length > 0,
    secretMasked: secret ? maskWebhookSecret(secret) : null,
    consecutiveFailures: row.consecutive_failures,
    disabledReason: row.disabled_reason,
    lastError: row.last_error,
    disabledNote: webhookDisabledNote(row.disabled_reason, row.last_error),
  }
}

function publicSiteUrl(): string {
  const raw = (
    process.env.STATUSSY_URL ??
    process.env.BETTER_AUTH_URL ??
    SITE_URL
  ).trim()
  return raw.replace(/\/$/, "") || SITE_URL
}

export async function getUserWebhookPrefs(
  userId: string
): Promise<UserWebhookPrefs | null> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }

  try {
    const { rows } = await pool.query<WebhookRow>(
      `SELECT url, enabled, signing_secret, consecutive_failures,
              disabled_reason, last_error
         FROM user_webhook_prefs
        WHERE user_id = $1`,
      [userId]
    )
    const row = rows[0]
    return row ? mapRow(row) : { ...DEFAULT_WEBHOOK_PREFS }
  } catch (err) {
    console.error(
      `[statussy] get user webhook prefs failed (db=${describeDatabaseTarget()})`,
      err
    )
    return null
  }
}

async function loadSecret(
  userId: string
): Promise<{ url: string; secret: string; enabled: boolean } | null> {
  const { getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }
  const { rows } = await pool.query<{
    url: string | null
    signing_secret: string
    enabled: boolean
  }>(
    `SELECT url, signing_secret, enabled
       FROM user_webhook_prefs
      WHERE user_id = $1`,
    [userId]
  )
  const row = rows[0]
  if (!row) {
    return null
  }
  return {
    url: row.url?.trim() ?? "",
    secret: row.signing_secret.trim(),
    enabled: row.enabled,
  }
}

/** Ensure Major is on when both severity toggles are off. Does not enable email. */
export async function ensureWebhookNotifyDefaults(
  userId: string
): Promise<void> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return
  }
  try {
    await pool.query(
      `INSERT INTO user_digest_prefs (
         user_id, email_enabled, notify_major, notify_partial, banner_dismissed
       )
       VALUES ($1, false, true, false, false)
       ON CONFLICT (user_id) DO UPDATE
         SET notify_major = CASE
               WHEN user_digest_prefs.notify_major = false
                AND user_digest_prefs.notify_partial = false
               THEN true
               ELSE user_digest_prefs.notify_major
             END,
             updated_at = now()`,
      [userId]
    )
  } catch (err) {
    console.error(
      `[statussy] ensure webhook notify defaults failed (db=${describeDatabaseTarget()})`,
      err
    )
  }
}

export async function saveUserWebhookUrl(
  userId: string,
  rawUrl: string
): Promise<{ prefs: UserWebhookPrefs; secretOnce: string | null } | null> {
  const parsed = parseWebhookUrl(rawUrl)
  if (!parsed.ok) {
    return {
      prefs: {
        ...(await getUserWebhookPrefs(userId)) ?? DEFAULT_WEBHOOK_PREFS,
        url: rawUrl.trim(),
      },
      secretOnce: null,
    }
  }

  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }

  try {
    const existing = await loadSecret(userId)
    const createdSecret = existing?.secret ? null : generateWebhookSecret()
    const secret = existing?.secret || createdSecret || generateWebhookSecret()
    const { rows } = await pool.query<WebhookRow>(
      `INSERT INTO user_webhook_prefs (
         user_id, url, enabled, signing_secret, consecutive_failures,
         disabled_reason, last_error
       )
       VALUES ($1, $2, false, $3, 0, NULL, NULL)
       ON CONFLICT (user_id) DO UPDATE
         SET url = EXCLUDED.url,
             consecutive_failures = 0,
             disabled_reason = NULL,
             last_error = NULL,
             updated_at = now()
       RETURNING url, enabled, signing_secret, consecutive_failures,
                 disabled_reason, last_error`,
      [userId, parsed.url, secret]
    )
    const row = rows[0]
    return {
      prefs: row ? mapRow(row) : { ...DEFAULT_WEBHOOK_PREFS, url: parsed.url },
      secretOnce: createdSecret,
    }
  } catch (err) {
    console.error(
      `[statussy] save user webhook url failed (db=${describeDatabaseTarget()})`,
      err
    )
    return null
  }
}

export async function setUserWebhookEnabled(
  userId: string,
  enabled: boolean
): Promise<UserWebhookPrefs | null> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }

  try {
    const existing = await loadSecret(userId)
    if (enabled) {
      if (!existing?.url || !existing.secret) {
        return (await getUserWebhookPrefs(userId)) ?? DEFAULT_WEBHOOK_PREFS
      }
      const parsed = parseWebhookUrl(existing.url)
      if (!parsed.ok) {
        return (await getUserWebhookPrefs(userId)) ?? DEFAULT_WEBHOOK_PREFS
      }
      await ensureWebhookNotifyDefaults(userId)
    }

    const { rows } = await pool.query<WebhookRow>(
      `UPDATE user_webhook_prefs
          SET enabled = $2,
              consecutive_failures = CASE WHEN $2 THEN 0 ELSE consecutive_failures END,
              disabled_reason = CASE WHEN $2 THEN NULL ELSE disabled_reason END,
              last_error = CASE WHEN $2 THEN NULL ELSE last_error END,
              updated_at = now()
        WHERE user_id = $1
        RETURNING url, enabled, signing_secret, consecutive_failures,
                  disabled_reason, last_error`,
      [userId, enabled]
    )
    const row = rows[0]
    return row ? mapRow(row) : { ...DEFAULT_WEBHOOK_PREFS }
  } catch (err) {
    console.error(
      `[statussy] set user webhook enabled failed (db=${describeDatabaseTarget()})`,
      err
    )
    return null
  }
}

export async function rotateUserWebhookSecret(
  userId: string
): Promise<{ prefs: UserWebhookPrefs; secretOnce: string } | null> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }

  try {
    const existing = await loadSecret(userId)
    if (!existing) {
      return null
    }
    const secretOnce = generateWebhookSecret()
    const { rows } = await pool.query<WebhookRow>(
      `UPDATE user_webhook_prefs
          SET signing_secret = $2,
              updated_at = now()
        WHERE user_id = $1
        RETURNING url, enabled, signing_secret, consecutive_failures,
                  disabled_reason, last_error`,
      [userId, secretOnce]
    )
    const row = rows[0]
    if (!row) {
      return null
    }
    return { prefs: mapRow(row), secretOnce }
  } catch (err) {
    console.error(
      `[statussy] rotate user webhook secret failed (db=${describeDatabaseTarget()})`,
      err
    )
    return null
  }
}

export async function revealUserWebhookSecret(
  userId: string
): Promise<string | null> {
  try {
    const existing = await loadSecret(userId)
    return existing?.secret || null
  } catch (err) {
    console.error("[statussy] reveal user webhook secret failed", err)
    return null
  }
}

export async function sendUserWebhookTest(userId: string): Promise<
  | { ok: true; prefs: UserWebhookPrefs }
  | { ok: false; error: string; prefs: UserWebhookPrefs | null }
> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  const current = await getUserWebhookPrefs(userId)
  if (!pool) {
    return { ok: false, error: "Could not send a test webhook.", prefs: current }
  }

  try {
    const existing = await loadSecret(userId)
    if (!existing?.url || !existing.secret) {
      return {
        ok: false,
        error: "Save an HTTPS webhook URL first.",
        prefs: current,
      }
    }
    const parsed = parseWebhookUrl(existing.url)
    if (!parsed.ok) {
      return { ok: false, error: parsed.error, prefs: current }
    }

    const checkedAt = new Date().toISOString()
    const payload = buildWebhookPayload(
      testWebhookServices(publicSiteUrl(), checkedAt)
    )
    payload.text = "Statussy test: webhook delivery is working."
    const body = serializeWebhookPayload(payload)
    const result = await deliverWebhook({
      url: parsed.url,
      secret: existing.secret,
      body,
    })

    if (result.ok) {
      await pool.query(
        `UPDATE user_webhook_prefs
            SET consecutive_failures = 0,
                last_error = NULL,
                last_success_at = now(),
                updated_at = now()
          WHERE user_id = $1`,
        [userId]
      )
      return {
        ok: true,
        prefs: (await getUserWebhookPrefs(userId)) ?? DEFAULT_WEBHOOK_PREFS,
      }
    }

    if (existing.enabled) {
      const next = applyWebhookFailure(current?.consecutiveFailures ?? 0)
      await pool.query(
        `UPDATE user_webhook_prefs
            SET consecutive_failures = $2,
                last_error = $3,
                enabled = CASE WHEN $4 THEN false ELSE enabled END,
                disabled_reason = CASE
                  WHEN $4 THEN $5
                  ELSE disabled_reason
                END,
                updated_at = now()
          WHERE user_id = $1`,
        [
          userId,
          next.consecutiveFailures,
          result.error.slice(0, 240),
          !next.enabled,
          WEBHOOK_DISABLED_REASON_FAILURES,
        ]
      )
    }

    return {
      ok: false,
      error: result.error,
      prefs: (await getUserWebhookPrefs(userId)) ?? current,
    }
  } catch (err) {
    console.error(
      `[statussy] send user webhook test failed (db=${describeDatabaseTarget()})`,
      err
    )
    return {
      ok: false,
      error: "Could not send a test webhook.",
      prefs: current,
    }
  }
}

export function webhookUrlError(rawUrl: string): string | null {
  const parsed = parseWebhookUrl(rawUrl)
  return parsed.ok ? null : parsed.error
}
