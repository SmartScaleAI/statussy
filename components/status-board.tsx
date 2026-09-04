import { ProviderSearchBar } from "@/components/provider-search-bar"
import { ServiceCard } from "@/components/service-card"
import { StatusSummary } from "@/components/status-summary"
import { getStatusBoard } from "@/lib/status"

export function StatusBoard() {
  const { items, summary, refreshedAt } = getStatusBoard()

  return (
    <section
      className="course-design-board flex flex-col gap-8"
      aria-label="AI provider status"
    >
      <StatusSummary
        operational={summary.operational}
        issues={summary.issues}
        total={summary.total}
        refreshedAt={refreshedAt}
      />
      <ProviderSearchBar />
      <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </ul>
    </section>
  )
}
