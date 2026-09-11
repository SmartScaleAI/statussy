/**
 * Per-user My Stack digest prefs (SMA-115 / SMA-118 / SMA-135).
 * Missing row = email off, banner not dismissed.
 * Always scoped by the Better Auth user id from the session.
 * Server-only (imports the Postgres pool).
 */

import {
  applyDigestPrefsPatch,
  DEFAULT_DIGEST_PREFS,
  type DigestPrefsPatch,
  type UserDigestPrefs,
} from "./digest-banner.ts"

export {
  applyDigestPrefsPatch,
  DEFAULT_DIGEST_PREFS,
  OPT_IN_DIGEST_PREFS,
  pickDigestPrefs,
  type DigestPrefsPatch,
  type UserDigestPrefs,
} from "./digest-banner.ts"

function mapRow(row: {
  email_enabled: boolean
  notify_major: boolean
  notify_partial: boolean
  banner_dismissed: boolean
}): UserDigestPrefs {
  return {
    emailEnabled: row.email_enabled,
    notifyMajor: row.notify_major,
    notifyPartial: row.notify_partial,
    bannerDismissed: row.banner_dismissed,
  }
}

export async function getUserDigestPrefs(
  userId: string
): Promise<UserDigestPrefs | null> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }

  try {
    const { rows } = await pool.query<{
      email_enabled: boolean
      notify_major: boolean
      notify_partial: boolean
      banner_dismissed: boolean
    }>(
      `SELECT email_enabled, notify_major, notify_partial, banner_dismissed
         FROM user_digest_prefs
        WHERE user_id = $1`,
      [userId]
    )
    const row = rows[0]
    return row ? mapRow(row) : { ...DEFAULT_DIGEST_PREFS }
  } catch (err) {
    console.error(
      `[statussy] get user digest prefs failed (db=${describeDatabaseTarget()})`,
      err
    )
    return null
  }
}

export async function setUserDigestPrefs(
  userId: string,
  patch: DigestPrefsPatch
): Promise<UserDigestPrefs | null> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return null
  }

  const current = await getUserDigestPrefs(userId)
  if (!current) {
    return null
  }
  const next = applyDigestPrefsPatch(current, patch)

  try {
    const { rows } = await pool.query<{
      email_enabled: boolean
      notify_major: boolean
      notify_partial: boolean
      banner_dismissed: boolean
    }>(
      `INSERT INTO user_digest_prefs (
         user_id, email_enabled, notify_major, notify_partial, banner_dismissed
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
         SET email_enabled = EXCLUDED.email_enabled,
             notify_major = EXCLUDED.notify_major,
             notify_partial = EXCLUDED.notify_partial,
             banner_dismissed = EXCLUDED.banner_dismissed,
             updated_at = now()
       RETURNING email_enabled, notify_major, notify_partial, banner_dismissed`,
      [
        userId,
        next.emailEnabled,
        next.notifyMajor,
        next.notifyPartial,
        next.bannerDismissed,
      ]
    )
    const row = rows[0]
    return row ? mapRow(row) : next
  } catch (err) {
    console.error(
      `[statussy] set user digest prefs failed (db=${describeDatabaseTarget()})`,
      err
    )
    return null
  }
}

/** Best-effort cleanup before account delete. CASCADE also applies. */
export async function deleteUserDigestPrefs(userId: string): Promise<void> {
  const { describeDatabaseTarget, getDatabasePool } = await import("./db.ts")
  const pool = getDatabasePool()
  if (!pool) {
    return
  }
  try {
    await pool.query(`DELETE FROM user_digest_prefs WHERE user_id = $1`, [
      userId,
    ])
    await pool.query(`DELETE FROM digest_sends WHERE user_id = $1`, [userId])
    await pool.query(`DELETE FROM digest_episode_mutes WHERE user_id = $1`, [
      userId,
    ])
  } catch (err) {
    console.error(
      `[statussy] delete user digest prefs failed (db=${describeDatabaseTarget()})`,
      err
    )
  }
}
