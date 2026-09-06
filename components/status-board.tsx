import { FavoriteServicesProvider } from "@/components/favorite-services"
import { MyServices } from "@/components/my-services"
import { ServiceCard } from "@/components/service-card"
import { StatusBoardGrid } from "@/components/status-board-grid"
import { getStatusBoard } from "@/lib/status-board"
import type { BoardStatus, ChickletDisplay } from "@/lib/status"
import { boardPaperClassName, cn } from "@/lib/utils"

function toSortFields(item: {
  id: string
  name: string
  status: BoardStatus
  chicklet: ChickletDisplay
  incidentTitle?: string
}) {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    healthPct: item.chicklet.healthPct,
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
          className={cn("flex flex-col gap-8", boardPaperClassName)}
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
