import { Suspense } from "react"

import { BoardPanes } from "@/components/board-panes"
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
      <div className="course-design-board">
        {/* SMA-133: line tabs mount one pane at a time so a long My Stack
            cannot bury All Services. The All Services grid (and each card)
            reads the ?category= filter with useSearchParams (SMA-89), which
            the 60s-cached prerender cannot know — so that subtree
            client-renders up to this Suspense boundary (SMA-97). Board data
            is embedded in the cached RSC payload. My Stack stays
            client-side (SMA-104): signed-in stars load from Railway via a
            server action so the ISR cache never embeds a user's stack.
            Last tab persists in localStorage when signed-in with favorites. */}
        <BoardPanes
          stack={
            <MyServices items={items.map((item) => toSortFields(item))}>
              {items.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </MyServices>
          }
          all={
            <Suspense
              fallback={
                <p className="text-sm text-muted-foreground" role="status">
                  Loading services…
                </p>
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
          }
        />
      </div>
    </FavoriteServicesProvider>
  )
}
