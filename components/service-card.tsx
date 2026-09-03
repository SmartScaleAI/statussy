import { ArrowUpRightIcon } from "lucide-react"

import { ProviderLogo } from "@/components/provider-logo"
import {
  formatCardDate,
  STATUS_HEALTH,
  STATUS_LABEL,
  type Service,
} from "@/lib/status"

export function ServiceCard({ service }: { service: Service }) {
  const health = STATUS_HEALTH[service.status]

  return (
    <li className="service-card" data-status={service.status}>
      <header className="service-card-header">
        <time className="service-card-date" dateTime={service.updatedAt}>
          {formatCardDate(service.updatedAt)}
        </time>
        <ProviderLogo id={service.id} name={service.name} className="size-8" />
      </header>
      <div className="service-card-body">
        <h3>{service.name}</h3>
        <p>{STATUS_LABEL[service.status]}</p>
        {service.incidentTitle ? (
          <p className="service-card-incident">{service.incidentTitle}</p>
        ) : null}
        <div className="service-card-progress">
          <span>Health</span>
          <div className="service-card-progress-track" aria-hidden="true">
            <div
              className="service-card-progress-fill"
              style={{ width: `${health}%` }}
            />
          </div>
        </div>
      </div>
      <footer className="service-card-footer">
        <a
          href={service.statusUrl}
          target="_blank"
          rel="noreferrer"
          className="service-card-status-link"
        >
          Official status
          <ArrowUpRightIcon data-icon="inline-end" />
        </a>
      </footer>
    </li>
  )
}
