/**
 * Per-user My Stack digest prefs (SMA-115).
 * Missing row = email off, banner not dismissed.
 * Always scoped by the Better Auth user id from the session.
 * Server-only (imports the Postgres pool).
 */

import { DEFAULT_DIGEST_PREFS, type UserDigestPrefs } from "./digest-banner.ts"

export { DEFAULT_DIGEST_PREFS, type UserDigestPrefs } from "./digest-banner.ts"

export type DigestPrefsPatch = {
  emailMajorPartial?: boolean
  bannerDismissed?: boolean
}

function mapRow(row: {
  email_major_partial: boolean
  banner_dismissed: boolean
}): UserDigestPrefs {
  return {
    emailMajorPartial: row.email_major_partial,
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
      email_major_partial: boolean
      banner_dismissed: boolean
    }>(
      `SELECT email_major_partial, banner_dismissed
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
  const next: UserDigestPrefs = {
    emailMajorPartial: patch.emailMajorPartial ?? current.emailMajorPartial,
    bannerDismissed:
      patch.emailMajorPartial === true
        ? true
        : (patch.bannerDismissed ?? current.bannerDismissed),
  }

  try {
    const { rows } = await pool.query<{
      email_major_partial: boolean
      banner_dismissed: boolean
    }>(
      `INSERT INTO user_digest_prefs (user_id, email_major_partial, banner_dismissed)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET email_major_partial = EXCLUDED.email_major_partial,
             banner_dismissed = EXCLUDED.banner_dismissed,
             updated_at = now()
       RETURNING email_major_partial, banner_dismissed`,
      [userId, next.emailMajorPartial, next.bannerDismissed]
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
  } catch (err) {
    console.error(
      `[statussy] delete user digest prefs failed (db=${describeDatabaseTarget()})`,
      err
    )
  }
}
