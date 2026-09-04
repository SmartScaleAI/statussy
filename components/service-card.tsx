import CourseCard from "@/components/ui/course-design-cards"
import {
  formatHistoryUptime,
  formatMockLatency,
  getStatusHistory,
  STATUS_LABEL,
  STATUS_SHORT,
  type Service,
  type ServiceStatus,
} from "@/lib/status"

/** Geist accents (https://vercel.com/geist/colors), driven by status severity. */
const STATUS_COLOR: Record<ServiceStatus, string> = {
  operational: "green",
  degraded: "amber",
  maintenance: "blue",
  partial_outage: "red",
  major_outage: "red",
}

export function ServiceCard({ service }: { service: Service }) {
  const label = STATUS_LABEL[service.status]
  const history = getStatusHistory(service)

  return (
    <li>
      <CourseCard
        data={{
          id: service.id,
          colorClass: STATUS_COLOR[service.status],
          title: service.name,
          description: service.incidentTitle ?? label,
          history,
          uptimeLabel: formatHistoryUptime(history),
          latencyLabel: formatMockLatency(service),
          imgSrc1: `/logos/${service.id}.svg`,
          imgAlt1: "",
          countdownText: "Official status",
          countdownHref: service.statusUrl,
          statusLabel: STATUS_SHORT[service.status],
        }}
      />
    </li>
  )
}
