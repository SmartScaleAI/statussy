import { ServiceRow } from "@/components/service-row"
import { StatusSummary } from "@/components/status-summary"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getStatusBoard, isOperational } from "@/lib/status"

export function StatusBoard() {
  const { items, summary, refreshedAt } = getStatusBoard()
  const issues = items.filter((item) => !isOperational(item.status))
  const healthy = items.filter((item) => isOperational(item.status))

  return (
    <section className="flex flex-col gap-6" aria-label="AI provider status">
      <StatusSummary
        operational={summary.operational}
        issues={summary.issues}
        total={summary.total}
        refreshedAt={refreshedAt}
      />
      <Card className="gap-0 py-0 ring-foreground/8">
        <CardContent className="px-0">
          <ul className="flex flex-col">
            {issues.map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))}
            {issues.length > 0 && healthy.length > 0 ? (
              <li aria-hidden="true" className="list-none">
                <Separator />
              </li>
            ) : null}
            {healthy.map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
