"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useFavoriteServices } from "@/components/favorite-services"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DEFAULT_BOARD_TAB,
  clearStoredBoardTab,
  isBoardTab,
  readStoredBoardTab,
  resolveBoardTab,
  shouldPersistBoardTab,
  writeStoredBoardTab,
  type BoardTab,
} from "@/lib/board-tab"

type BoardTabActions = {
  showAllServices: () => void
}

const BoardTabActionsContext = createContext<BoardTabActions | null>(null)

export function useBoardTabActions() {
  const context = useContext(BoardTabActionsContext)
  if (!context) {
    throw new Error("useBoardTabActions must be used within BoardPanes")
  }
  return context
}

export function BoardPanes({
  stack,
  all,
  initialTab = DEFAULT_BOARD_TAB,
}: {
  stack: ReactNode
  all: ReactNode
  /** SSR first-paint tab (SMA-143 / SMA-145). Hydration must match this value. */
  initialTab?: BoardTab
}) {
  const { signedIn, isLoading, favoriteIds } = useFavoriteServices()
  const favoriteCount = favoriteIds.length
  const [tab, setTab] = useState<BoardTab>(initialTab)
  const userChose = useRef(false)
  // Defaults apply once per signed-in session — starring the first
  // service from All Services must not yank the pane to My Stack.
  const didResolve = useRef(false)

  // Signed-out first paint stays All Services without an effect setState.
  const visibleTab = !isLoading && !signedIn ? DEFAULT_BOARD_TAB : tab

  useEffect(() => {
    if (isLoading) {
      return
    }
    if (!signedIn) {
      userChose.current = false
      didResolve.current = false
      clearStoredBoardTab()
      return
    }
    if (userChose.current || didResolve.current) {
      return
    }
    didResolve.current = true
    const next = resolveBoardTab({
      signedIn,
      favoriteCount,
      // Treat SSR My Stack as the stored default so a missing cookie
      // does not flip away from first paint. Do not treat SSR All
      // Services as a stored choice — that is the empty/signed-out
      // default, not last-tab.
      stored: readStoredBoardTab() ?? (initialTab === "stack" ? "stack" : null),
    })
    if (shouldPersistBoardTab({ signedIn, favoriteCount })) {
      writeStoredBoardTab(next)
    } else {
      clearStoredBoardTab()
    }
    if (next !== tab) {
      // localStorage / cookie last-tab after auth+favorites settle.
      // First render already used initialTab so hydration matches SSR.
      queueMicrotask(() => {
        setTab(next)
      })
    }
  }, [favoriteCount, initialTab, isLoading, signedIn, tab])

  const selectTab = useCallback(
    (next: BoardTab, persistChoice: boolean) => {
      userChose.current = true
      setTab(next)
      if (persistChoice && shouldPersistBoardTab({ signedIn, favoriteCount })) {
        writeStoredBoardTab(next)
      } else if (!shouldPersistBoardTab({ signedIn, favoriteCount })) {
        clearStoredBoardTab()
      }
    },
    [favoriteCount, signedIn]
  )

  const onValueChange = useCallback(
    (next: unknown) => {
      if (!isBoardTab(next)) {
        return
      }
      selectTab(next, true)
    },
    [selectTab]
  )

  const actions = useMemo<BoardTabActions>(
    () => ({
      showAllServices: () => {
        selectTab("all", true)
      },
    }),
    [selectTab]
  )

  return (
    <BoardTabActionsContext.Provider value={actions}>
      <Tabs
        value={visibleTab}
        onValueChange={onValueChange}
        className="w-full gap-8"
      >
        {/* SMA-136: default pill segment (rounded track + active outline).
            Track fill is the rail card surface (--bg-footer), same as
            Recently added / Report Suggest. Triggers stay content-width
            (SMA-134) so the track hugs the two labels. */}
        <TabsList
          aria-label="Board views"
          className="rounded-full bg-[var(--bg-footer)]"
        >
          <TabsTrigger className="flex-none rounded-full px-3" value="stack">
            My Stack
          </TabsTrigger>
          <TabsTrigger className="flex-none rounded-full px-3" value="all">
            All Services
          </TabsTrigger>
        </TabsList>
        {/* keepMounted false: Option A — only one grid mounted.
            No board-level hold-with-loader (SMA-143): first HTML already
            has the SSR tab from the ISR variant; My Stack keeps its own
            favorites loader. */}
        <TabsContent value="stack" keepMounted={false}>
          {stack}
        </TabsContent>
        <TabsContent value="all" keepMounted={false}>
          {all}
        </TabsContent>
      </Tabs>
    </BoardTabActionsContext.Provider>
  )
}
