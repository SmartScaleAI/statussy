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

function BoardPaneLoader() {
  return (
    <div className="flex justify-center pt-8 pb-10">
      {/* Decorative: sr-only text is the accessible name. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/my-stack-loader.gif"
        alt=""
        width={32}
        height={32}
        className="size-8"
      />
      <span className="sr-only">Loading board</span>
    </div>
  )
}

export function BoardPanes({
  stack,
  all,
}: {
  stack: ReactNode
  all: ReactNode
}) {
  const { signedIn, isLoading, favoriteIds } = useFavoriteServices()
  const favoriteCount = favoriteIds.length
  const [tab, setTab] = useState<BoardTab>("all")
  const [ready, setReady] = useState(false)
  const userChose = useRef(false)
  // Defaults apply once per signed-in session — starring the first
  // service from All Services must not yank the pane to My Stack.
  const didResolve = useRef(false)

  useEffect(() => {
    if (isLoading) {
      return
    }
    if (!signedIn) {
      userChose.current = false
      didResolve.current = false
      setTab("all")
      setReady(true)
      return
    }
    if (userChose.current || didResolve.current) {
      setReady(true)
      return
    }
    didResolve.current = true
    setTab(
      resolveBoardTab({
        signedIn,
        favoriteCount,
        stored: readStoredBoardTab(),
      })
    )
    setReady(true)
  }, [favoriteCount, isLoading, signedIn])

  const selectTab = useCallback(
    (next: BoardTab, persistChoice: boolean) => {
      setTab(next)
      setReady(true)
      if (persistChoice && shouldPersistBoardTab({ signedIn, favoriteCount })) {
        writeStoredBoardTab(next)
      }
    },
    [favoriteCount, signedIn]
  )

  const onValueChange = useCallback(
    (next: unknown) => {
      if (!isBoardTab(next)) {
        return
      }
      userChose.current = true
      selectTab(next, true)
    },
    [selectTab]
  )

  const actions = useMemo<BoardTabActions>(
    () => ({
      showAllServices: () => {
        userChose.current = true
        selectTab("all", true)
      },
    }),
    [selectTab]
  )

  const showLoader = signedIn && (!ready || isLoading)

  return (
    <BoardTabActionsContext.Provider value={actions}>
      <Tabs value={tab} onValueChange={onValueChange} className="w-full gap-8">
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
        {showLoader ? (
          <BoardPaneLoader />
        ) : (
          <>
            {/* keepMounted false: Option A — only one grid mounted. */}
            <TabsContent value="stack" keepMounted={false}>
              {stack}
            </TabsContent>
            <TabsContent value="all" keepMounted={false}>
              {all}
            </TabsContent>
          </>
        )}
      </Tabs>
    </BoardTabActionsContext.Provider>
  )
}
