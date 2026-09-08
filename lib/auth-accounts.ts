import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import type { LinkedAccount } from "@/lib/sign-in-methods"

export async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  try {
    const accounts = await auth.api.listUserAccounts({
      headers: await headers(),
    })
    return accounts.map((account) => ({
      id: account.id,
      providerId: account.providerId,
    }))
  } catch (err) {
    console.error("[statussy] listLinkedAccounts failed", err)
    return []
  }
}
