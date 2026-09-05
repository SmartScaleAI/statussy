import { FavoriteServicesProvider } from "@/components/favorite-services"
import { MyServices } from "@/components/my-services"
import { ServiceCard } from "@/components/service-card"
import { StatusBoardGrid } from "@/components/status-board-grid"
import { parseHealthLabel } from "@/lib/board-sort"
import { getStatusBoard } from "@/lib/status-board"
import type { BoardStatus } from "@/lib/status"

function toSortFields(item: {
  id: string
  name: string
  status: BoardStatus
  healthLabel: string | null
  incidentTitle?: string
}) {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    healthPct: parseHealthLabel(item.healthLabel),
    hasActiveIncident: Boolean(item.incidentTitle),
  }
}

export async function StatusBoard() {
  const { items } = await getStatusBoard()

  return (
    <FavoriteServicesProvider>
      <div className="course-design-board flex flex-col gap-8">
        <MyServices items={items.map((item) => toSortFields(item))}>
          {items.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </MyServices>
        <section
          className="flex flex-col gap-8"
          aria-labelledby="all-services-heading"
        >
          <StatusBoardGrid
            items={items.map((item) => ({
              ...toSortFields(item),
              category: item.category,
            }))}
          >
            {items.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </StatusBoardGrid>
        </section>
      </div>
    </FavoriteServicesProvider>
  )
}
