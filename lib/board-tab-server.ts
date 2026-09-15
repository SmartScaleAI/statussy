/**
 * Request-time homepage tab (SMA-143). Not imported by client components.
 *
 * Session + Railway favorite count pick the locked default; the
 * `statussy:boardTab` cookie supplies last-tab when persistence applies.
 * cookies() / headers() make this route request-specific so the first
 * HTML can already be My Stack — the shared 60s board snapshot cache
 * (SMA-97) must not embed another user's tab.
 */

import { cookies } from "next/headers"
import { unstable_rethrow } from "next/navigation"
import { cache } from "react"

import {
  BOARD_TAB_KEY,
  parseBoardTab,
  resolveServerBoardTab,
  type BoardTab,
} from "@/lib/board-tab"
import { getSessionUserId } from "@/lib/session-user"
import { listUserFavoriteIds } from "@/lib/user-favorites"

export const getInitialBoardTab = cache(
  async function getInitialBoardTab(): Promise<BoardTab> {
    // Do not catch cookies() — Next throws during static generation so
    // `/` and `/services` render per-request instead of sharing a tab.
    const stored = parseBoardTab((await cookies()).get(BOARD_TAB_KEY)?.value)
    try {
      const userId = await getSessionUserId()
      if (!userId) {
        return resolveServerBoardTab({
          signedIn: false,
          favoriteCount: 0,
          stored,
        })
      }
      const favoriteIds = await listUserFavoriteIds(userId)
      return resolveServerBoardTab({
        signedIn: true,
        favoriteCount: favoriteIds?.length ?? null,
        stored,
      })
    } catch (err) {
      unstable_rethrow(err)
      console.error("[statussy] getInitialBoardTab failed", err)
      return resolveServerBoardTab({
        signedIn: false,
        favoriteCount: 0,
        stored,
      })
    }
  }
)
