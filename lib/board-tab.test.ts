import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BOARD_TAB_KEY,
  DEFAULT_BOARD_TAB,
  isBoardTab,
  parseBoardTab,
  resolveBoardTab,
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
