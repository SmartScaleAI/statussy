import { Badge } from "@/components/ui/badge"
import { STATUS_LABEL, type ServiceStatus } from "@/lib/status"

const STATUS_VARIANT = {
  operational: "success",
  degraded: "warning",
  partial_outage: "destructive",
  major_outage: "destructive",
  maintenance: "warning",
} as const

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </Badge>
  )
}
