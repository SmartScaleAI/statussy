/**
 * My Stack email digests (SMA-115).
 *
 * After a poll settles: users who opted in get one Resend email if any
 * favorite transitioned *into* Major or Partial from a healthier state.
 * Recoveries, still-bad, Degraded-only, Maintenance, and Live are skipped.
 * `digest_sends (user_id, poll_id)` makes the same snapshot set idempotent.
 */
import { createHash } from "node:crypto"
import type pg from "pg"

import type { ServiceStatus } from "./statuspage.js"

/** Lower number = more urgent. Matches app `STATUS_RANK` (lib/status.ts). */
export const STATUS_RANK: Record<ServiceStatus, number> = {
  major_outage: 0,
  partial_outage: 1,
  degraded: 2,
  maintenance: 3,
  unknown: 4,
  operational: 5,
}

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: "Live",
  degraded: "Degraded",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
  unknown: "Unknown",
}

const DIGEST_TO = new Set<ServiceStatus>(["major_outage", "partial_outage"])

export type StatusTransition = {
  serviceId: string
  name: string
  from: ServiceStatus
  to: ServiceStatus
}

export type DigestUser = {
  userId: string
  email: string
  favoriteIds: string[]
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
    })
  }
  return items
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

/** One digest per user — never one email per service. */
export function groupUserDigests(
  users: readonly DigestUser[],
  transitions: readonly StatusTransition[]
): UserDigest[] {
  const digests: UserDigest[] = []
  for (const user of users) {
    const items = digestForUser(user, transitions)
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

export function digestBoardUrl(publicSiteUrl: string): string {
  return publicSiteUrl.replace(/\/$/, "") || "https://www.statussy.com"
}

export function digestServiceUrl(
  publicSiteUrl: string,
  serviceId: string
): string {
  return `${digestBoardUrl(publicSiteUrl)}/services/${serviceId}`
}

export function digestTextBody(
  items: readonly StatusTransition[],
  publicSiteUrl: string
): string {
  const board = digestBoardUrl(publicSiteUrl)
  const lines = items.map(
    (item) =>
      `- ${item.name}: ${STATUS_LABEL[item.to]} (${digestServiceUrl(publicSiteUrl, item.serviceId)})`
  )
  return [
    "These services in your stack need attention:",
    "",
    ...lines,
    "",
    `Open your board: ${board}`,
  ].join("\n")
}

export function digestHtmlBody(
  items: readonly StatusTransition[],
  publicSiteUrl: string
): string {
  const board = digestBoardUrl(publicSiteUrl)
  const rows = items
    .map((item) => {
      const href = digestServiceUrl(publicSiteUrl, item.serviceId)
      const name = escapeHtml(item.name)
      const status = escapeHtml(STATUS_LABEL[item.to])
      return `<li><a href="${href}">${name}</a> — ${status}</li>`
    })
    .join("")
  return [
    `<p style="font-family:system-ui,sans-serif;font-size:16px;margin:0 0 12px"><strong>Statussy</strong></p>`,
    `<p style="font-family:system-ui,sans-serif;font-size:14px;margin:0 0 12px">These services in your stack need attention:</p>`,
    `<ul style="font-family:system-ui,sans-serif;font-size:14px;padding-left:20px">${rows}</ul>`,
    `<p style="font-family:system-ui,sans-serif;font-size:14px;margin:16px 0 0"><a href="${board}">Open your board</a></p>`,
  ].join("")
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

type LatestPairRow = {
  service_id: string
  name: string
  snapshot_id: string
  status: ServiceStatus
  rn: string | number
}

type SubscriberRow = {
  user_id: string
  email: string
  service_id: string
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
         row_number() OVER (
           PARTITION BY snap.service_id
           ORDER BY snap.fetched_at DESC, snap.id DESC
         ) AS rn
       FROM service_snapshots snap
       JOIN services svc ON svc.id = snap.service_id
     )
     SELECT service_id, name, snapshot_id, status, rn
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
    `SELECT u.id AS user_id, u.email, uf.service_id
       FROM user_digest_prefs p
       JOIN "user" u ON u.id = p.user_id
       JOIN user_favorites uf ON uf.user_id = p.user_id
      WHERE p.email_major_partial = true
        AND length(btrim(u.email)) > 0
      ORDER BY u.id, uf.created_at ASC, uf.service_id ASC`
  )
  const digests = groupUserDigests(
    groupSubscriberRows(subscriberRows),
    transitions
  )
  if (digests.length === 0) {
    return empty
  }

  if (!options.mailer) {
    console.warn(
      `[digest] ${digests.length} user(s) have Major/Partial transitions; set RESEND_API_KEY and RESEND_FROM on the worker to send`
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

export function createResendMailer(apiKey: string, from: string): DigestMailer {
  return async ({ to, subject, text, html }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text, html }),
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Resend ${response.status}: ${body.slice(0, 240)}`)
    }
  }
}
