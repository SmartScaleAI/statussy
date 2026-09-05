import assert from "node:assert/strict"
import { test } from "node:test"

import {
  ALL_SERVICES_PAGE_SIZE,
  paginateItems,
  paginationItems,
} from "./board-pagination.ts"

test("ALL_SERVICES_PAGE_SIZE is 15", () => {
  assert.equal(ALL_SERVICES_PAGE_SIZE, 15)
})

test("paginateItems slices 15 per page and clamps the page", () => {
  const items = Array.from({ length: 26 }, (_, index) => index + 1)
  const first = paginateItems(items, 1)
  assert.deepEqual(first.pageItems, items.slice(0, 15))
  assert.equal(first.page, 1)
  assert.equal(first.pageCount, 2)
  assert.equal(first.total, 26)

  const second = paginateItems(items, 2)
  assert.deepEqual(second.pageItems, items.slice(15))
  assert.equal(second.page, 2)

  assert.equal(paginateItems(items, 0).page, 1)
  assert.equal(paginateItems(items, 99).page, 2)
})

test("paginateItems keeps an empty list on page 1", () => {
  const empty = paginateItems([], 4)
  assert.deepEqual(empty.pageItems, [])
  assert.equal(empty.page, 1)
  assert.equal(empty.pageCount, 1)
  assert.equal(empty.total, 0)
})

test("paginationItems lists every page when there are few", () => {
  assert.deepEqual(paginationItems(1, 1), [1])
  assert.deepEqual(paginationItems(2, 2), [1, 2])
})

test("paginationItems inserts ellipses for a long range", () => {
  assert.deepEqual(paginationItems(1, 12), [1, 2, "ellipsis", 12])
  assert.deepEqual(paginationItems(6, 12), [1, "ellipsis", 5, 6, 7, "ellipsis", 12])
  assert.deepEqual(paginationItems(12, 12), [1, "ellipsis", 11, 12])
})
