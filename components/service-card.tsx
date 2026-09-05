import CourseCard from "@/components/ui/course-design-cards"
import {
  formatCardUpdatedAt,
  STATUS_SHORT,
  type BoardService,
  type BoardStatus,
} from "@/lib/status"

/** Geist accents (https://vercel.com/geist/colors), driven by status severity. */
const STATUS_COLOR: Record<BoardStatus, string> = {
  operational: "green",
  degraded: "amber",
  maintenance: "blue",
  partial_outage: "red",
  major_outage: "red",
  unknown: "gray",
}

export function ServiceCard({ service }: { service: BoardService }) {
  return (
    <li>
      <CourseCard
        data={{
          id: service.id,
          colorClass: STATUS_COLOR[service.status],
          title: service.name,
          healthLabel: service.healthLabel ?? undefined,
          stale: service.stale,
          imgSrc1: `/logos/${service.id}.svg`,
          imgAlt1: "",
          detailHref: `/services/${service.id}`,
          countdownText: "Click to View",
          statusLabel: STATUS_SHORT[service.status],
          updatedAt: service.updatedAt,
          updatedLabel: formatCardUpdatedAt(service.updatedAt),
        }}
      />
    </li>
  )
}
