/**
 * After a tick writes snapshots, delete the cached board HTML on the
 * Next.js app. `revalidatePath` with no cache profile expires immediately,
 * so the next request renders in the foreground. It must not use
 * `revalidateTag(..., "max")`, which serves the previous document while
 * regenerating (`x-vercel-cache: STALE`).
 */
import { randomBytes } from "node:crypto"

import type pg from "pg"

export const BOARD_REVALIDATE_PATH = "/api/revalidate-board"

const SECRET_BYTES = 32

export function boardRevalidateEndpoint(publicSiteUrl: string): string {
  const base = publicSiteUrl.replace(/\/$/, "") || "https://www.statussy.com"
  return `${base}${BOARD_REVALIDATE_PATH}`
}

type SecretQuery = {
  query: (
    sql: string,
    values?: unknown[]
  ) => Promise<{ rows: Array<{ secret?: string }> }>
}

/**
 * Read the shared bearer, inserting one if the table is empty. Concurrent
 * workers insert once; the loser selects the winner's row.
 */
export async function ensureBoardRevalidateSecret(
  pool: SecretQuery | pg.Pool
): Promise<string> {
  const existing = await pool.query(
    "SELECT secret FROM board_revalidate_secret WHERE id = true"
  )
  const current = existing.rows[0]?.secret
  if (typeof current === "string" && current.length >= 32) {
    return current
  }

  const secret = randomBytes(SECRET_BYTES).toString("hex")
  await pool.query(
    `INSERT INTO board_revalidate_secret (id, secret)
     VALUES (true, $1)
     ON CONFLICT (id) DO NOTHING`,
    [secret]
  )
  const again = await pool.query(
    "SELECT secret FROM board_revalidate_secret WHERE id = true"
  )
  const stored = again.rows[0]?.secret
  if (typeof stored !== "string" || stored.length < 32) {
    throw new Error("board revalidate secret was not stored")
  }
  return stored
}

export async function purgeBoardCache(options: {
  publicSiteUrl: string
  secret: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<{ ok: boolean; status: number }> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 8_000
  // `manual` so a redirect cannot forward the bearer to another host.
  const response = await fetchImpl(
    boardRevalidateEndpoint(options.publicSiteUrl),
    {
      method: "POST",
      headers: { authorization: `Bearer ${options.secret}` },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    }
  )
  return { ok: response.ok, status: response.status }
}
