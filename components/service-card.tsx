import { ArrowUpRightIcon } from "lucide-react"

import { ProviderLogo } from "@/components/provider-logo"
import {
  formatTimestamp,
  STATUS_HEALTH,
  STATUS_LABEL,
  type Service,
} from "@/lib/status"

export function ServiceCard({ service }: { service: Service }) {
  const health = STATUS_HEALTH[service.status]
  const statusLabel = STATUS_LABEL[service.status]

  return (
    <li>
      <article
        data-status={service.status}
        className="status-course-card flex min-h-80 flex-col overflow-hidden text-center"
      >
        <header className="flex items-center justify-between gap-3 px-6 pt-4 pb-1">
          <time dateTime={service.updatedAt} className="text-sm text-white/70">
            {formatTimestamp(service.updatedAt)}
          </time>
          <ProviderLogo id={service.id} name={service.name} />
        </header>

        <div className="flex flex-1 flex-col justify-center gap-2 px-6 py-4">
          <h2 className="font-heading text-[1.375rem] leading-snug font-semibold text-white">
            {service.name}
          </h2>
          <p className="text-base tracking-wide text-white/70">{statusLabel}</p>
          {service.incidentTitle ? (
            <p className="text-sm text-white/55">{service.incidentTitle}</p>
          ) : null}

          <div className="mt-3.5 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-white">Health</span>
              <span className="text-sm text-white">{health}%</span>
            </div>
            <div
              className="relative h-[0.313rem] w-full overflow-hidden rounded-full bg-[#363636]"
              role="progressbar"
              aria-label={`${service.name} health`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={health}
              aria-valuetext={`${health} percent, ${statusLabel}`}
            >
              <span
                className="status-course-card-fill absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${health}%` }}
              />
            </div>
          </div>
        </div>

        <footer className="mt-auto flex items-center justify-end border-t border-[#292929] bg-[#151419] px-6 py-3.5">
          <a
            href={service.statusUrl}
            target="_blank"
            rel="noreferrer"
            className="status-course-card-link inline-flex items-center gap-1 rounded-full bg-[#222127] px-6 py-2.5 text-sm text-white transition-colors"
          >
            Official status
            <ArrowUpRightIcon className="size-3.5" />
          </a>
        </footer>
      </article>
    </li>
  )
}
