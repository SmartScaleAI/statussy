import { ArrowUpRightIcon } from "lucide-react"

import { ProviderLogo } from "@/components/provider-logo"
import { StatusBadge } from "@/components/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isOperational, type Service, type ServiceStatus } from "@/lib/status"

const ACCENT: Record<ServiceStatus, string> = {
  operational: "border-transparent",
  degraded: "border-l-warning",
  partial_outage: "border-l-destructive",
  major_outage: "border-l-destructive",
  maintenance: "border-l-warning",
}

export function ServiceRow({ service }: { service: Service }) {
  const healthy = isOperational(service.status)

  return (
    <li
      className={cn(
        "flex flex-col gap-2 border-l-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        ACCENT[service.status],
        healthy ? "bg-transparent" : "bg-muted/30"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <ProviderLogo id={service.id} className="mt-0.5" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-medium tracking-tight text-foreground">
            {service.name}
          </p>
          {service.incidentTitle ? (
            <p className="text-sm text-muted-foreground">
              {service.incidentTitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={service.status} />
        <a
          href={service.statusUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: "link", size: "sm" }),
            "text-muted-foreground"
          )}
        >
          Official status
          <ArrowUpRightIcon data-icon="inline-end" />
        </a>
      </div>
    </li>
  )
}
