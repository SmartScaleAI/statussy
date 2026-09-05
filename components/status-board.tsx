import { FavoriteServicesProvider } from "@/components/favorite-services"
import { MyServices } from "@/components/my-services"
import { ServiceCard } from "@/components/service-card"
import { StatusBoardGrid } from "@/components/status-board-grid"
import { getStatusBoard } from "@/lib/status-board"

export async function StatusBoard() {
  const { items } = await getStatusBoard()

  return (
    <FavoriteServicesProvider>
      <div className="course-design-board flex flex-col gap-8">
        <MyServices
          items={items.map((item) => ({
            id: item.id,
            status: item.status,
          }))}
        >
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
              id: item.id,
              name: item.name,
              category: item.category,
              status: item.status,
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
