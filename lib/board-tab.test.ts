import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BOARD_TAB_KEY,
  DEFAULT_BOARD_TAB,
  isBoardTab,
  parseBoardTab,
  parseBoardTabCookieHeader,
  resolveBoardTab,
  resolveServerBoardTab,
  shouldPersistBoardTab,
} from "./board-tab.ts"

test("parseBoardTab accepts only stack | all", () => {
  assert.equal(parseBoardTab(null), null)
  assert.equal(parseBoardTab(undefined), null)
  assert.equal(parseBoardTab("nope"), null)
  assert.equal(parseBoardTab("stack"), "stack")
  assert.equal(parseBoardTab("all"), "all")
  assert.equal(isBoardTab("stack"), true)
  assert.equal(isBoardTab("health"), false)
})

test("signed-out or empty stack always lands on All Services", () => {
  assert.equal(
    resolveBoardTab({ signedIn: false, favoriteCount: 0, stored: "stack" }),
    DEFAULT_BOARD_TAB
  )
  assert.equal(
    resolveBoardTab({ signedIn: false, favoriteCount: 4, stored: "stack" }),
    "all"
  )
  assert.equal(
    resolveBoardTab({ signedIn: true, favoriteCount: 0, stored: "stack" }),
    "all"
  )
})

test("signed-in with favorites uses stored tab, else My Stack", () => {
  assert.equal(
    resolveBoardTab({ signedIn: true, favoriteCount: 1, stored: null }),
    "stack"
  )
  assert.equal(
    resolveBoardTab({ signedIn: true, favoriteCount: 3, stored: "all" }),
    "all"
  )
  assert.equal(
    resolveBoardTab({ signedIn: true, favoriteCount: 3, stored: "stack" }),
    "stack"
  )
})

test("last tab is persisted only when signed-in with favorites", () => {
  assert.equal(BOARD_TAB_KEY, "statussy:boardTab")
  assert.equal(
    shouldPersistBoardTab({ signedIn: true, favoriteCount: 1 }),
    true
  )
  assert.equal(
    shouldPersistBoardTab({ signedIn: true, favoriteCount: 0 }),
    false
  )
  assert.equal(
    shouldPersistBoardTab({ signedIn: false, favoriteCount: 2 }),
    false
  )
})

test("parseBoardTabCookieHeader reads statussy:boardTab", () => {
  assert.equal(parseBoardTabCookieHeader(null), null)
  assert.equal(parseBoardTabCookieHeader(""), null)
  assert.equal(parseBoardTabCookieHeader("other=stack"), null)
  assert.equal(
    parseBoardTabCookieHeader("theme=dark; statussy:boardTab=stack"),
    "stack"
  )
  assert.equal(
    parseBoardTabCookieHeader("statussy:boardTab=all; theme=dark"),
    "all"
  )
  assert.equal(parseBoardTabCookieHeader("statussy:boardTab=nope"), null)
})

test("SSR resolver ignores stored tab when signed out or empty", () => {
  assert.equal(
    resolveServerBoardTab({
      signedIn: false,
      favoriteCount: 3,
      stored: "stack",
    }),
    "all"
  )
  assert.equal(
    resolveServerBoardTab({
      signedIn: true,
      favoriteCount: 0,
      stored: "stack",
    }),
    "all"
  )
})

test("SSR resolver uses stored tab, else My Stack, when signed-in with favorites", () => {
  assert.equal(
    resolveServerBoardTab({
      signedIn: true,
      favoriteCount: 2,
      stored: null,
    }),
    "stack"
  )
  assert.equal(
    resolveServerBoardTab({
      signedIn: true,
      favoriteCount: 2,
      stored: "all",
    }),
    "all"
  )
})

test("SSR resolver honors cookie when favorite count is unknown", () => {
  assert.equal(
    resolveServerBoardTab({
      signedIn: true,
      favoriteCount: null,
      stored: "all",
    }),
    "all"
  )
  assert.equal(
    resolveServerBoardTab({
      signedIn: true,
      favoriteCount: null,
      stored: "stack",
    }),
    "stack"
  )
  assert.equal(
    resolveServerBoardTab({
      signedIn: true,
      favoriteCount: null,
      stored: null,
    }),
    "all"
  )
  assert.equal(
    resolveServerBoardTab({
      signedIn: false,
      favoriteCount: null,
      stored: "stack",
    }),
    "all"
  )
})
