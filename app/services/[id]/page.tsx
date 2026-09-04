import { ArrowLeftIcon, ArrowUpRightIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { services } from "@/data/services"
import {
  getServiceLiveDetail,
  isSnapshotStale,
  type LiveStatus,
  type ServiceIncident,
} from "@/lib/live-status"
import { formatTimestamp, STATUS_LABEL, type BoardStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

type PageProps = {
  params: Promise<{ id: string }>
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

  // Status must reflect the DB at request time, never a build-time prerender.
  await connection()
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
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          All services
        </Link>

        <section className="flex flex-col gap-4" aria-label="Overall status">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/logos/${service.id}.svg`}
              alt=""
              className={cn(
                "size-10 shrink-0 object-contain",
                // xAI mark is white-on-transparent; invert on light surfaces.
                service.id === "xai" && "invert dark:invert-0"
              )}
            />
            <div className="flex flex-col gap-1">
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                {service.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={status} />
                {stale ? <StaleBadge /> : null}
              </div>
            </div>
          </div>
          {incidentTitle ? (
            <p className="text-sm text-muted-foreground">{incidentTitle}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Updated{" "}
            <time dateTime={updatedAtIso}>{formatTimestamp(updatedAtIso)}</time>
            {" · "}
            <a
              href={service.statusUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Official status page
              <ArrowUpRightIcon aria-hidden="true" className="size-3" />
            </a>
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
      <SiteFooter className="max-w-3xl" showSuggest={false} />
    </div>
  )
}
