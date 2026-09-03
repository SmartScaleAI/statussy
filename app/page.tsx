import { StatusBoard } from "@/components/status-board"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-12 px-6 py-16 sm:py-24">
        <header className="flex flex-col gap-2">
          <p className="font-heading text-xl tracking-tight text-foreground">
            Statussy
          </p>
          <h1 className="text-sm text-muted-foreground">
            One place to see if AI is down.
          </h1>
        </header>
        <StatusBoard />
      </main>
      <footer className="mx-auto w-full max-w-2xl px-6 pb-10">
        <p className="text-xs text-muted-foreground">
          mock data · live feeds next
        </p>
      </footer>
    </div>
  )
}
