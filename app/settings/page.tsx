import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SettingsForm } from "@/components/settings-form"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { listLinkedAccounts } from "@/lib/auth-accounts"
import { getAuthSession } from "@/lib/auth-session"
import { SIGN_IN_QUERY } from "@/lib/sign-in-methods"

export const metadata: Metadata = {
  title: "Settings · Statussy",
  description:
    "Manage your Statussy account, connected sign-in methods, and data.",
}

export default async function SettingsPage() {
  const session = await getAuthSession()
  if (!session?.user) {
    redirect(`/?${SIGN_IN_QUERY}=1`)
  }

  const accounts = await listLinkedAccounts()
  const email = session.user.email ?? ""

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8 sm:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Your email, connected accounts, and account deletion.
          </p>
        </header>
        <SettingsForm email={email} accounts={accounts} />
      </main>
      <SiteFooter className="max-w-3xl" showSuggest={false} />
    </div>
  )
}
