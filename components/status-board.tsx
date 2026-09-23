import { Suspense } from "react"

import { BoardFreshnessProvider } from "@/components/board-clock"
import { BoardPanes } from "@/components/board-panes"
import { FavoriteServicesProvider } from "@/components/favorite-services"
import { MyServices } from "@/components/my-services"
import { ServiceCard } from "@/components/service-card"
import { StatusBoardGrid } from "@/components/status-board-grid"
import { DEFAULT_BOARD_TAB, type BoardTab } from "@/lib/board-tab"
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

export async function StatusBoard({
  initialTab = DEFAULT_BOARD_TAB,
}: {
  initialTab?: BoardTab
} = {}) {
  const { items, refreshedAt } = await getStatusBoard()

  return (
    <FavoriteServicesProvider>
      <BoardFreshnessProvider refreshedAt={refreshedAt}>
        <div className="course-design-board">
          {/* SMA-133 / SMA-136: pill tabs mount one pane at a time so a long
            My Stack cannot bury All Services. The All Services grid (and
            each card) reads the ?category= filter with useSearchParams
            (SMA-89), which the 60s-cached prerender cannot know — so that
            subtree client-renders up to this Suspense boundary (SMA-97).
            Board snapshots stay on the 60s getStatusBoard ISR cadence
            (SMA-145): this component must not read cookies/session, or the
            shared HTML cache is lost. initialTab comes from the route
            (All Services on `/` and `/services`; My Stack on the internal
            rewrite variant). My Stack cards stay client-side (SMA-104 /
            SMA-146) so the payload never embeds a user's stack. Favorites
            prefetch on the client in parallel with auth — still not from
            this server render. Last tab persists in localStorage and a
            mirroring cookie when signed-in with favorites. */}
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
      </BoardFreshnessProvider>
    </FavoriteServicesProvider>
  )
}
