import { revalidatePath } from "next/cache"

import {
  bearerToken,
  boardRevalidateSecretsMatch,
} from "@/lib/board-revalidate-auth"
import { readBoardRevalidateSecret } from "@/lib/live-status"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Worker tick hook. Deletes cached board HTML (`revalidatePath` has no
 * cache profile, so the next request is a foreground miss). Do not switch
 * this to `revalidateTag(tag, "max")`: that marks the page stale and
 * Vercel answers with the previous HTML (`x-vercel-cache: STALE`).
 */
export async function POST(request: Request) {
  const expected = await readBoardRevalidateSecret()
  if (!expected) {
    return Response.json(
      { ok: false },
      { status: 503, headers: { "cache-control": "no-store" } }
    )
  }
  const provided = bearerToken(request.headers.get("authorization"))
  if (!boardRevalidateSecretsMatch(provided, expected)) {
    return Response.json(
      { ok: false },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  // Root layout covers `/`, `/services`, the My Stack rewrites, and
  // `/services/[id]`. Settings stays dynamic, so this does not cache it.
  revalidatePath("/", "layout")

  return Response.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } }
  )
}
