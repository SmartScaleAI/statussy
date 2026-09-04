import { ModeToggle } from "@/components/mode-toggle"
import { StatusBoard } from "@/components/status-board"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-16 sm:py-24">
        <header className="flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-2.5 font-heading text-2xl font-semibold tracking-tight text-foreground">
            {/* Black rounded mark; the white S stays visible on light and dark. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.svg"
              alt=""
              width={24}
              height={24}
              className="size-[1em]"
            />
            Statussy
          </h1>
          <ModeToggle />
        </header>
        <StatusBoard />
      </main>
      <footer className="mx-auto w-full max-w-5xl px-6 pb-10">
        <p className="text-xs text-muted-foreground">
          mock data · live feeds next
        </p>
      </footer>
    </div>
  )
}
