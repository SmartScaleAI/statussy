import { ModeToggle } from "@/components/mode-toggle"
import { StatusBoard } from "@/components/status-board"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-8 sm:pt-12">
        <h1 className="flex items-center gap-2.5 font-heading text-2xl font-semibold tracking-tight text-foreground">
          {/* Brand mark is a black tile with a white S — readable in light and dark. */}
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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8 sm:py-12">
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
