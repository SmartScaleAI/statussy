import { ServiceCard } from "@/components/service-card"
import { StatusSummary } from "@/components/status-summary"
import { getStatusBoard } from "@/lib/status"

export function StatusBoard() {
  const { items, summary, refreshedAt } = getStatusBoard()

  return (
    <section className="flex flex-col gap-6" aria-label="AI provider status">
      <StatusSummary
        operational={summary.operational}
        issues={summary.issues}
        total={summary.total}
        refreshedAt={refreshedAt}
      />
      <ul className="grid list-none grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </ul>
    </section>
  )
}
