import { ArrowUpDownIcon, FunnelIcon, SearchIcon } from "lucide-react"

import { ServiceCard } from "@/components/service-card"
import { StatusSummary } from "@/components/status-summary"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
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
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <InputGroup className="min-w-0 flex-1">
            <InputGroupInput
              id="provider-search"
              type="search"
              placeholder="Search providers by name..."
              aria-label="Search providers by name"
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Filters"
          >
            <FunnelIcon />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label="Sort">
            <ArrowUpDownIcon />
          </Button>
        </div>
        <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </ul>
      </div>
    </section>
  )
}
