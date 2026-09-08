import { Suspense } from "react"

import { FavoriteServicesProvider } from "@/components/favorite-services"
import { MyServices } from "@/components/my-services"
import { ServiceCard } from "@/components/service-card"
import { StatusBoardGrid } from "@/components/status-board-grid"
import { getStatusBoard } from "@/lib/status-board"
import type { BoardStatus, ChickletDisplay } from "@/lib/status"

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
  const { items, refreshedAt } = await getStatusBoard()

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
          {/* The grid (and each card) reads the ?category= filter with
              useSearchParams (SMA-89), which the 60s-cached prerender cannot
              know — so this subtree client-renders up to this Suspense
              boundary (SMA-97). The board data is embedded in the cached RSC
              payload, so hydration fills it in without another request. My
              Stack above is untouched: favorites/sort live in localStorage
              and render client-side either way. */}
          <Suspense
            fallback={
              <div className="flex flex-col gap-3">
                <h2
                  id="all-services-heading"
                  className="font-heading text-lg font-semibold tracking-tight text-foreground"
                >
                  All Services
                </h2>
                <p className="text-sm text-muted-foreground" role="status">
                  Loading services…
                </p>
              </div>
            }
          >
            <StatusBoardGrid
              items={items.map((item) => ({
                ...toSortFields(item),
                category: item.category,
              }))}
              refreshedAt={refreshedAt}
            >
              {items.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </StatusBoardGrid>
          </Suspense>
        </section>
      </div>
    </FavoriteServicesProvider>
  )
}
