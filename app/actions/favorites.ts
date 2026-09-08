"use server"

import { unstable_rethrow } from "next/navigation"

import { getSessionUserId } from "@/lib/session-user"
import {
  listUserFavoriteIds,
  parseServiceId,
  toggleUserFavorite,
} from "@/lib/user-favorites"

export type FavoritesState = {
  signedIn: boolean
  favoriteIds: string[]
}

const SIGNED_OUT: FavoritesState = { signedIn: false, favoriteIds: [] }

/**
 * Current user's My Stack. Session user id is read server-side only, so
 * another user's stars cannot be requested.
 */
export async function getMyFavorites(): Promise<FavoritesState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const favoriteIds = await listUserFavoriteIds(userId)
    return { signedIn: true, favoriteIds: favoriteIds ?? [] }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] getMyFavorites failed", err)
    return SIGNED_OUT
  }
}

/**
 * Star / unstar one catalog service for the signed-in user.
 * Signed-out callers get an empty stack and no write (SMA-103 opens login).
 */
export async function toggleMyFavorite(
  serviceId: string
): Promise<FavoritesState> {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return SIGNED_OUT
    }
    const id = parseServiceId(serviceId)
    if (!id) {
      const favoriteIds = await listUserFavoriteIds(userId)
      return { signedIn: true, favoriteIds: favoriteIds ?? [] }
    }
    const favoriteIds = await toggleUserFavorite(userId, id)
    return { signedIn: true, favoriteIds: favoriteIds ?? [] }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[statussy] toggleMyFavorite failed", err)
    return SIGNED_OUT
  }
}
