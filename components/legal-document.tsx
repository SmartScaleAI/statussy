import type { ReactNode } from "react"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

const EFFECTIVE_DATE = "September 8, 2026"
const OPERATOR = "SmartScale Solutions LLC (“we”, “us”)"

export function LegalDocument({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8 sm:py-12">
        <article className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Effective date:
              </span>{" "}
              {EFFECTIVE_DATE}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Operator:</span>{" "}
              {OPERATOR}
            </p>
          </header>
          {children}
        </article>
      </main>
      <SiteFooter className="max-w-3xl" />
    </div>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-foreground">{children}</p>
}

export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
      {children}
    </ul>
  )
}

export function ContactEmail() {
  return (
    <a
      href="mailto:support@smartaiscaling.com"
      className="font-semibold underline-offset-2 hover:underline"
    >
      support@smartaiscaling.com
    </a>
  )
}
