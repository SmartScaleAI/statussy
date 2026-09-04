import CourseCard from "@/components/ui/course-design-cards"
import {
  STATUS_HEALTH,
  STATUS_LABEL,
  STATUS_SHORT,
  type Service,
  type ServiceStatus,
} from "@/lib/status"

/** 21st.dev color themes, driven by status severity — not random. */
const STATUS_COLOR: Record<ServiceStatus, string> = {
  operational: "green",
  degraded: "orange",
  maintenance: "blue",
  partial_outage: "red",
  major_outage: "red",
}

export function ServiceCard({ service }: { service: Service }) {
  const label = STATUS_LABEL[service.status]

  return (
    <li>
      <CourseCard
        data={{
          id: service.id,
          colorClass: STATUS_COLOR[service.status],
          title: service.name,
          description: service.incidentTitle ?? label,
          progressPercent: `${STATUS_HEALTH[service.status]}%`,
          progressValue: label,
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
