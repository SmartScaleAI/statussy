import { ArrowUpRightIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import {
  BackToBoardLink,
  BackToBoardLinkFallback,
} from "@/components/board-back-link"
import { ServiceDetailFavorite } from "@/components/service-detail-favorite"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { buttonVariants } from "@/components/ui/button"
import { distinctCategories } from "@/lib/board-filter"
import { services } from "@/data/services"
import {
  getServiceLiveDetail,
  isSnapshotStale,
  type LiveStatus,
  type ServiceIncident,
} from "@/lib/live-status"
import { logoInvertClass } from "@/lib/light-logo-ids"
import { formatTimestamp, STATUS_LABEL, type BoardStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

type PageProps = {
  params: Promise<{ id: string }>
}

/**
 * ISR (SMA-97): serve detail pages from the Vercel/Next page cache and
 * re-render each at most every 60s — same window and rationale as the board
 * (`app/page.tsx`). Must stay a literal for static analysis.
 */
export const revalidate = 60

/**
 * Empty on purpose: with ~450 registry services (3 DB queries each), build
 * would hammer Postgres prerendering pages nobody visits. An empty array
 * keeps the route on the static/ISR path (without it Next renders the route
 * dynamically on every hit), and each page renders on first visit, then
 * stays cached for the 60s window.
 */
export function generateStaticParams(): Array<{ id: string }> {
  return []
}

/** Geist accents by severity — matches the board card palette. */
const STATUS_TEXT: Record<BoardStatus, string> = {
  operational: "text-[#15803d] dark:text-[#48aa4a]",
  degraded: "text-[#d97706] dark:text-[#fdb203]",
  maintenance: "text-[#276df5] dark:text-[#276df5]",
  partial_outage: "text-[#dc2626] dark:text-[#de4649]",
  major_outage: "text-[#dc2626] dark:text-[#de4649]",
  unknown: "text-[#737373] dark:text-[#8f8f8f]",
}

const STATUS_DOT: Record<BoardStatus, string> = {
  operational: "bg-[#15803d] dark:bg-[#48aa4a]",
  degraded: "bg-[#d97706] dark:bg-[#fdb203]",
  maintenance: "bg-[#276df5] dark:bg-[#276df5]",
  partial_outage: "bg-[#dc2626] dark:bg-[#de4649]",
  major_outage: "bg-[#dc2626] dark:bg-[#de4649]",
  unknown: "bg-[#737373] dark:bg-[#8f8f8f]",
}

function StatusChip({
  status,
  className,
}: {
  status: LiveStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-semibold",
        STATUS_TEXT[status],
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])}
      />
      {STATUS_LABEL[status]}
    </span>
  )
}

function StaleBadge() {
  return (
    <span
      className="rounded-full border border-border bg-muted px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase"
      title="Last fetch failed or data is out of date"
    >
      Stale
    </span>
  )
}

/** Vendor impact labels are free-form; title-case for display. */
function formatImpact(impact: string) {
  return impact.charAt(0).toUpperCase() + impact.slice(1)
}

function formatIncidentStatus(status: string) {
  const label = status.replaceAll("_", " ")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function IncidentItem({ incident }: { incident: ServiceIncident }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-foreground">
          {incident.url ? (
            <a
              href={incident.url}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {incident.title}
            </a>
          ) : (
            incident.title
          )}
        </span>
        {incident.impact ? (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
            {formatImpact(incident.impact)}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {formatIncidentStatus(incident.status)} · updated{" "}
        <time dateTime={incident.updatedAt.toISOString()}>
          {formatTimestamp(incident.updatedAt.toISOString())}
        </time>
      </p>
    </li>
  )
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const service = services.find((entry) => entry.id === id)
  if (!service) {
    return { title: "Service not found · Statussy" }
  }
  return {
    title: `${service.name} status · Statussy`,
    description: `Live status, components, and active incidents for ${service.name}.`,
  }
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { id } = await params
  // Registry of known services — same source as the board grid.
  const service = services.find((entry) => entry.id === id)
  if (!service) {
    notFound()
  }

  // No `connection()` gate (SMA-97): the route is ISR-cached (see
  // `revalidate` above), so this DB read runs at most ~once a minute per
  // service. Timestamps and the Stale badge come from the snapshot itself,
  // so a ≤60s-old cached view keeps honest, DB-driven freshness.
  const detail = await getServiceLiveDetail(id)
  const snapshot = detail?.snapshot ?? null

  // Same fallback policy as the board: mock entry until a snapshot exists.
  const status: LiveStatus = snapshot?.status ?? service.status
  const updatedAtIso = snapshot?.fetchedAt.toISOString() ?? service.updatedAt
  const stale = snapshot ? isSnapshotStale(snapshot) : false
  const incidentTitle = snapshot
    ? (snapshot.incidentTitle ?? undefined)
    : service.incidentTitle
  const components = detail?.components ?? []
  const activeIncidents = detail?.activeIncidents ?? []

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8 sm:py-12">
        {/* Both controls are shrink-0 via buttonVariants, so the row never
            wraps Official status under Back on narrow viewports. */}
        <div className="flex items-center justify-between gap-3">
          {/* Back restores the board category filter (SMA-89). The category
              is read from the URL on the client so the cached page (SMA-97)
              stays shared across ?category= variants; the fallback is the
              same chip pointing at the bare board. Arrow lives on the
              client chip (SMA-94) so the cached shell and hydrated link match. */}
          <Suspense fallback={<BackToBoardLinkFallback />}>
            <BackToBoardLink categories={distinctCategories(services)} />
          </Suspense>
          <a
            href={service.statusUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({
              variant: "default",
              size: "default",
            })}
          >
            Official status
            <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
          </a>
        </div>

        <section className="flex flex-col gap-4" aria-label="Overall status">
          <div className="flex min-w-0 items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/logos/${service.id}.svg`}
              alt=""
              className={cn(
                "size-10 shrink-0 object-contain",
                // SMA-93: white-on-transparent marks invert on light surfaces.
                logoInvertClass(service.id)
              )}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-1">
                <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight text-foreground">
                  {service.name}
                </h1>
                {/* SMA-128: same My Stack star as the board; kept next to
                    the title so it does not compete with Back / Official
                    status tap targets on narrow viewports. */}
                <ServiceDetailFavorite serviceId={service.id} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={status} />
                {stale ? <StaleBadge /> : null}
              </div>
            </div>
          </div>
          {incidentTitle ? (
            <p className="text-sm text-muted-foreground">{incidentTitle}</p>
          ) : null}
          {service.scopeNote ? (
            <p className="text-xs text-muted-foreground">{service.scopeNote}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Updated{" "}
            <time dateTime={updatedAtIso}>{formatTimestamp(updatedAtIso)}</time>
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-label="Active incidents">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Active incidents
          </h2>
          {activeIncidents.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {activeIncidents.map((incident) => (
                <IncidentItem key={incident.id} incident={incident} />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No active incidents.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3" aria-label="Components">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Components
          </h2>
          {components.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {components.map((component) => (
                <li
                  key={component.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="text-sm text-foreground">
                    {component.name}
                  </span>
                  <StatusChip status={component.status} className="text-xs" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No components reported for this service yet.
            </p>
          )}
        </section>
      </main>
      <SiteFooter className="max-w-3xl" />
    </div>
  )
}
