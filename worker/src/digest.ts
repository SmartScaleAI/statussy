/**
 * My Stack email digests (SMA-115 / SMA-118 / SMA-131 / SMA-132).
 *
 * After a poll settles: opted-in users get one Resend email if a favorite
 * transitioned *into* Major or Partial from a healthier state and their
 * toggles allow it. Partial is rate-limited to one email per favorite
 * every 6 hours. Recoveries, still-bad, Degraded-only, Maintenance, and
 * Live are skipped. `digest_sends (user_id, poll_id)` makes the same
 * snapshot set idempotent.
 *
 * HTML/text bodies live in digest-email.ts (dark card template).
 */
import { createHash } from "node:crypto"
import type pg from "pg"

import { resolveDigestFrom } from "./config.js"
import {
  digestHtmlBody,
  digestPrefsUrl,
  digestTextBody,
} from "./digest-email.js"
import type { ServiceStatus } from "./statuspage.js"

export {
  digestAttentionTitle,
  digestBoardUrl,
  digestHtmlBody,
  digestMarkUrl,
  digestPrefsUrl,
  digestServiceUrl,
  digestTextBody,
  STATUS_LABEL,
} from "./digest-email.js"

/** At most one Partial digest email per user+favorite in this window. */
export const PARTIAL_COOLDOWN_MS = 6 * 60 * 60 * 1000

/** Lower number = more urgent. Matches app `STATUS_RANK` (lib/status.ts). */
export const STATUS_RANK: Record<ServiceStatus, number> = {
  major_outage: 0,
  partial_outage: 1,
  degraded: 2,
  maintenance: 3,
  unknown: 4,
  operational: 5,
}

const DIGEST_TO = new Set<ServiceStatus>(["major_outage", "partial_outage"])

export type StatusTransition = {
  serviceId: string
  name: string
  from: ServiceStatus
  to: ServiceStatus
  /** Vendor status page, when known. Optional Official status link. */
  statusUrl?: string
}

export type DigestNotifyPrefs = {
  notifyMajor: boolean
  notifyPartial: boolean
}

export type DigestUser = {
  userId: string
  email: string
  favoriteIds: string[]
  notifyMajor: boolean
  notifyPartial: boolean
}

export type UserDigest = {
  user: DigestUser
  items: StatusTransition[]
}

export type DigestMailer = (input: {
  to: string
  subject: string
  text: string
  html: string
}) => Promise<void>

/**
 * Notify only transitions *into* Major or Partial from a healthier rank.
 * No previous snapshot → not a transition (skip first-seen).
 */
export function isDigestTransition(
  from: ServiceStatus | null,
  to: ServiceStatus
): boolean {
  if (from == null) {
    return false
  }
  if (!DIGEST_TO.has(to)) {
    return false
  }
  return STATUS_RANK[from] > STATUS_RANK[to]
}

export function collectTransitions(
  pairs: ReadonlyArray<{
    serviceId: string
    name: string
    previous: ServiceStatus | null
    current: ServiceStatus
    statusUrl?: string
  }>
): StatusTransition[] {
  const items: StatusTransition[] = []
  for (const pair of pairs) {
    if (!isDigestTransition(pair.previous, pair.current)) {
      continue
    }
    items.push({
      serviceId: pair.serviceId,
      name: pair.name,
      from: pair.previous as ServiceStatus,
      to: pair.current,
      ...(pair.statusUrl ? { statusUrl: pair.statusUrl } : {}),
    })
  }
  return items
}

export function toEpochMs(value: Date | number): number {
  return typeof value === "number" ? value : value.getTime()
}

/** True when the last Partial email for this favorite is still inside 6h. */
export function isPartialCooldownActive(
  lastNotifiedAt: Date | number | null | undefined,
  now: Date | number,
  cooldownMs = PARTIAL_COOLDOWN_MS
): boolean {
  if (lastNotifiedAt == null) {
    return false
  }
  return toEpochMs(now) - toEpochMs(lastNotifiedAt) < cooldownMs
}

export function filterDigestItems(
  items: readonly StatusTransition[],
  prefs: DigestNotifyPrefs,
  lastPartialAt: ReadonlyMap<string, Date | number>,
  now: Date | number
): StatusTransition[] {
  return items.filter((item) => {
    if (item.to === "major_outage") {
      return prefs.notifyMajor
    }
    if (item.to === "partial_outage") {
      if (!prefs.notifyPartial) {
        return false
      }
      return !isPartialCooldownActive(lastPartialAt.get(item.serviceId), now)
    }
    return false
  })
}

export function digestForUser(
  user: DigestUser,
  transitions: readonly StatusTransition[]
): StatusTransition[] {
  const favorites = new Set(user.favoriteIds)
  return transitions
    .filter((item) => favorites.has(item.serviceId))
    .sort((a, b) => {
      const rank = STATUS_RANK[a.to] - STATUS_RANK[b.to]
      if (rank !== 0) {
        return rank
      }
      return a.name.localeCompare(b.name)
    })
}

export function qualifyingDigestItems(
  user: DigestUser,
  transitions: readonly StatusTransition[],
  lastPartialAt: ReadonlyMap<string, Date | number>,
  now: Date | number
): StatusTransition[] {
  return filterDigestItems(
    digestForUser(user, transitions),
    { notifyMajor: user.notifyMajor, notifyPartial: user.notifyPartial },
    lastPartialAt,
    now
  )
}

/** One digest per user — never one email per service. */
export function groupUserDigests(
  users: readonly DigestUser[],
  transitions: readonly StatusTransition[],
  lastPartialAtByUser: ReadonlyMap<
    string,
    ReadonlyMap<string, Date | number>
  > = new Map(),
  now: Date | number = 0
): UserDigest[] {
  const digests: UserDigest[] = []
  for (const user of users) {
    const items = qualifyingDigestItems(
      user,
      transitions,
      lastPartialAtByUser.get(user.userId) ?? new Map(),
      now
    )
    if (items.length > 0) {
      digests.push({ user, items })
    }
  }
  return digests
}

export function digestPollId(
  snapshotIds: ReadonlyArray<string | number>
): string {
  const normalized = [...snapshotIds].map(String).sort().join(",")
  return createHash("sha256").update(normalized).digest("hex")
}

export function digestSubject(count: number): string {
  if (count === 1) {
    return "Statussy: 1 service in your stack needs attention"
  }
  return `Statussy: ${count} services in your stack need attention`
}

export function digestResendHeaders(
  publicSiteUrl: string
): Record<string, string> {
  return {
    "List-Unsubscribe": `<${digestPrefsUrl(publicSiteUrl)}>`,
  }
}

type LatestPairRow = {
  service_id: string
  name: string
  snapshot_id: string
  status: ServiceStatus
  status_url?: string | null
  rn: string | number
}

type SubscriberRow = {
  user_id: string
  email: string
  service_id: string
  notify_major: boolean
  notify_partial: boolean
}

export type DigestRunResult = {
  sent: number
  users: number
  skipped: number
}

export type DigestRunOptions = {
  publicSiteUrl: string
  mailer: DigestMailer | null
}

function groupSubscriberRows(rows: SubscriberRow[]): DigestUser[] {
  const byUser = new Map<string, DigestUser>()
  for (const row of rows) {
    const email = row.email.trim()
    if (!email) {
      continue
    }
    const existing = byUser.get(row.user_id)
    if (existing) {
      existing.favoriteIds.push(row.service_id)
      continue
    }
    byUser.set(row.user_id, {
      userId: row.user_id,
      email,
      favoriteIds: [row.service_id],
      notifyMajor: row.notify_major,
      notifyPartial: row.notify_partial,
    })
  }
  return [...byUser.values()]
}

export function pairsFromSnapshotRows(rows: LatestPairRow[]): {
  pairs: Array<{
    serviceId: string
    name: string
    previous: ServiceStatus | null
    current: ServiceStatus
    statusUrl?: string
  }>
  snapshotIds: string[]
} {
  const current = new Map<string, LatestPairRow>()
  const previous = new Map<string, LatestPairRow>()
  for (const row of rows) {
    const rn = Number(row.rn)
    if (rn === 1) {
      current.set(row.service_id, row)
    } else if (rn === 2) {
      previous.set(row.service_id, row)
    }
  }
  const pairs = [...current.values()].map((row) => ({
    serviceId: row.service_id,
    name: row.name,
    previous: previous.get(row.service_id)?.status ?? null,
    current: row.status,
    ...(row.status_url ? { statusUrl: row.status_url } : {}),
  }))
  return {
    pairs,
    snapshotIds: [...current.values()].map((row) => String(row.snapshot_id)),
  }
}

export async function sendStackDigests(
  pool: pg.Pool,
  options: DigestRunOptions
): Promise<DigestRunResult> {
  const empty: DigestRunResult = { sent: 0, users: 0, skipped: 0 }
  const { rows: snapshotRows } = await pool.query<LatestPairRow>(
    `WITH ranked AS (
       SELECT
         snap.service_id,
         svc.name,
         snap.id::text AS snapshot_id,
         snap.status,
         svc.status_url,
         row_number() OVER (
           PARTITION BY snap.service_id
           ORDER BY snap.fetched_at DESC, snap.id DESC
         ) AS rn
       FROM service_snapshots snap
       JOIN services svc ON svc.id = snap.service_id
     )
     SELECT service_id, name, snapshot_id, status, status_url, rn
       FROM ranked
      WHERE rn <= 2`
  )
  const { pairs, snapshotIds } = pairsFromSnapshotRows(snapshotRows)
  if (snapshotIds.length === 0) {
    return empty
  }
  const pollId = digestPollId(snapshotIds)
  const transitions = collectTransitions(pairs)
  if (transitions.length === 0) {
    return empty
  }

  const { rows: subscriberRows } = await pool.query<SubscriberRow>(
    `SELECT u.id AS user_id, u.email, uf.service_id,
            p.notify_major, p.notify_partial
       FROM user_digest_prefs p
       JOIN "user" u ON u.id = p.user_id
       JOIN user_favorites uf ON uf.user_id = p.user_id
      WHERE p.email_enabled = true
        AND (p.notify_major = true OR p.notify_partial = true)
        AND length(btrim(u.email)) > 0
      ORDER BY u.id, uf.created_at ASC, uf.service_id ASC`
  )
  const users = groupSubscriberRows(subscriberRows)
  const lastPartialAtByUser = await loadPartialNotifyTimes(
    pool,
    users.map((user) => user.userId)
  )
  const now = new Date()
  const digests = groupUserDigests(
    users,
    transitions,
    lastPartialAtByUser,
    now
  )
  if (digests.length === 0) {
    return empty
  }

  if (!options.mailer) {
    console.warn(
      `[digest] ${digests.length} user(s) have qualifying transitions; set RESEND_API_KEY and RESEND_FROM on the worker to send`
    )
    return { sent: 0, users: digests.length, skipped: digests.length }
  }

  let sent = 0
  let skipped = 0
  for (const digest of digests) {
    const claimed = await claimDigestSend(
      pool,
      digest.user.userId,
      pollId,
      digest.items.length
    )
    if (!claimed) {
      skipped += 1
      continue
    }
    try {
      await options.mailer({
        to: digest.user.email,
        subject: digestSubject(digest.items.length),
        text: digestTextBody(digest.items, options.publicSiteUrl),
        html: digestHtmlBody(digest.items, options.publicSiteUrl),
      })
      sent += 1
      try {
        await recordPartialNotifies(
          pool,
          digest.user.userId,
          digest.items,
          now
        )
      } catch (err) {
        console.error(
          `[digest] partial cooldown persist failed user=${digest.user.userId}: ${(err as Error).message}`
        )
      }
    } catch (err) {
      await releaseDigestSend(pool, digest.user.userId, pollId).catch(() => {})
      console.error(
        `[digest] send failed user=${digest.user.userId}: ${(err as Error).message}`
      )
      skipped += 1
    }
  }
  return { sent, users: digests.length, skipped }
}

async function loadPartialNotifyTimes(
  pool: pg.Pool,
  userIds: string[]
): Promise<Map<string, Map<string, Date>>> {
  const byUser = new Map<string, Map<string, Date>>()
  if (userIds.length === 0) {
    return byUser
  }
  const { rows } = await pool.query<{
    user_id: string
    service_id: string
    last_notified_at: Date
  }>(
    `SELECT user_id, service_id, last_notified_at
       FROM digest_partial_notifies
      WHERE user_id = ANY($1::text[])`,
    [userIds]
  )
  for (const row of rows) {
    let inner = byUser.get(row.user_id)
    if (!inner) {
      inner = new Map()
      byUser.set(row.user_id, inner)
    }
    inner.set(row.service_id, row.last_notified_at)
  }
  return byUser
}

async function recordPartialNotifies(
  pool: pg.Pool,
  userId: string,
  items: readonly StatusTransition[],
  notifiedAt: Date
): Promise<void> {
  const partials = items.filter((item) => item.to === "partial_outage")
  if (partials.length === 0) {
    return
  }
  const values: unknown[] = []
  const tuples = partials.map((item, index) => {
    const base = index * 3
    values.push(userId, item.serviceId, notifiedAt)
    return `($${base + 1}, $${base + 2}, $${base + 3})`
  })
  await pool.query(
    `INSERT INTO digest_partial_notifies (user_id, service_id, last_notified_at)
     VALUES ${tuples.join(", ")}
     ON CONFLICT (user_id, service_id)
     DO UPDATE SET last_notified_at = EXCLUDED.last_notified_at`,
    values
  )
}

export async function claimDigestSend(
  pool: pg.Pool,
  userId: string,
  pollId: string,
  serviceCount: number
): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO digest_sends (user_id, poll_id, service_count)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, poll_id) DO NOTHING`,
    [userId, pollId, serviceCount]
  )
  return (result.rowCount ?? 0) > 0
}

export async function releaseDigestSend(
  pool: pg.Pool,
  userId: string,
  pollId: string
): Promise<void> {
  await pool.query(
    `DELETE FROM digest_sends WHERE user_id = $1 AND poll_id = $2`,
    [userId, pollId]
  )
}

export function createResendMailer(
  apiKey: string,
  from: string,
  publicSiteUrl = "https://www.statussy.com"
): DigestMailer {
  const resolvedFrom = resolveDigestFrom(from)
  const headers = digestResendHeaders(publicSiteUrl)
  return async ({ to, subject, text, html }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resolvedFrom,
        to,
        subject,
        text,
        html,
        headers,
      }),
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Resend ${response.status}: ${body.slice(0, 240)}`)
    }
  }
}
