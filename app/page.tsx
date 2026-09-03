import { StatusBoard } from "@/components/status-board"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-16 sm:py-24">
        <header className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2.5 font-heading text-xl tracking-tight text-foreground">
            {/* Dark-readable mark (white on black) from the brand kit. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/app-icon-dark-rounded.svg"
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-md"
            />
            Statussy
          </h1>
          <p className="text-sm text-muted-foreground">
            One place to see if AI is down.
          </p>
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
