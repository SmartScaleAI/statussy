import { ReportSuggestForm } from "@/components/report-suggest-form"
import { services } from "@/data/services"

function catalogServiceNames() {
  return [...new Set(services.map((service) => service.name))].sort((a, b) =>
    a.localeCompare(b)
  )
}

/**
 * Report / Suggest rail (SMA-120, width SMA-124). Sits to the right of
 * the whole board on desktop (My Stack + All Services); stacks below
 * Recently added (SMA-123) on mobile.
 */
export function ReportSuggestPanel() {
  return (
    <div className="course-design-board">
      <div className="card plain">
        <div className="suggest-card-body">
          <ReportSuggestForm serviceNames={catalogServiceNames()} />
        </div>
      </div>
    </div>
  )
}
