import { ModeToggle } from "@/components/mode-toggle"
import { StatusBoard } from "@/components/status-board"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 w-full items-center justify-between px-4 sm:h-16 sm:px-5">
        <h1 className="flex items-center gap-2.5 font-heading text-2xl font-semibold leading-none tracking-tight text-foreground">
          {/* Light: black mark. Dark: white-on-black tile. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-light.svg"
            alt=""
            width={24}
            height={24}
            className="size-[1em] dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.svg"
            alt=""
            width={24}
            height={24}
            className="hidden size-[1em] dark:block"
          />
          Statussy
        </h1>
        <ModeToggle />
      </header>
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
