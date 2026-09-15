import { Suspense } from "react"

import { BoardPanes } from "@/components/board-panes"
import { FavoriteServicesProvider } from "@/components/favorite-services"
import { MyServices } from "@/components/my-services"
import { ServiceCard } from "@/components/service-card"
import { StatusBoardGrid } from "@/components/status-board-grid"
import { getInitialBoardTab } from "@/lib/board-tab-server"
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
  const [{ items, refreshedAt }, initialTab] = await Promise.all([
    getStatusBoard(),
    getInitialBoardTab(),
  ])

  return (
    <FavoriteServicesProvider>
      <div className="course-design-board">
        {/* SMA-133 / SMA-136: pill tabs mount one pane at a time so a long
            My Stack cannot bury All Services. The All Services grid (and
            each card) reads the ?category= filter with useSearchParams
            (SMA-89), which the 60s-cached prerender cannot know — so that
            subtree client-renders up to this Suspense boundary (SMA-97).
            Board snapshots stay on the 60s getStatusBoard cadence. The
            selected tab is request-specific (SMA-143): session + favorite
            count + statussy:boardTab cookie pick initialTab so first HTML
            is already My Stack when appropriate. My Stack cards stay
            client-side (SMA-104) so the payload never embeds a user's
            stack. Last tab persists in localStorage and a mirroring cookie
            when signed-in with favorites. */}
        <BoardPanes
          initialTab={initialTab}
          stack={
            <MyServices
              items={items.map((item) => toSortFields(item))}
              refreshedAt={refreshedAt}
            >
              {items.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </MyServices>
          }
          all={
            <Suspense
              fallback={
                <div className="flex flex-col gap-3">
                  <h2
                    id="all-services-heading"
                    className="font-heading text-lg font-semibold tracking-tight text-foreground md:text-xl"
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
          }
        />
      </div>
    </FavoriteServicesProvider>
  )
}
