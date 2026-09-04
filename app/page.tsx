import { SiteHeader } from "@/components/site-header"
import { StatusBoard } from "@/components/status-board"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8 sm:py-12">
        <StatusBoard />
      </main>
      <footer className="mx-auto w-full max-w-5xl px-6 pb-10">
        <p className="text-xs text-muted-foreground">
          live status from Postgres · mock fallback for unfetched providers
        </p>
      </footer>
    </div>
  )
}
