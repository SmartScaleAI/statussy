/** All Services grid page size (SMA catalog board). */
export const ALL_SERVICES_PAGE_SIZE = 15

export type Paginated<T> = {
  pageItems: T[]
  page: number
  pageCount: number
  pageSize: number
  total: number
}

/**
 * Slice a filtered/sorted list into a 1-based page.
 * Empty lists still report page 1 / pageCount 1 so the UI can hide the pager.
 */
export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize = ALL_SERVICES_PAGE_SIZE
): Paginated<T> {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const start = (currentPage - 1) * pageSize
  return {
    pageItems: items.slice(start, start + pageSize),
    page: currentPage,
    pageCount,
    pageSize,
    total,
  }
}

export type PaginationToken = number | "ellipsis"

/** Compact page tokens: 1 … 4 5 6 … 12 */
export function paginationItems(
  page: number,
  pageCount: number
): PaginationToken[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const tokens: PaginationToken[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  if (start > 2) {
    tokens.push("ellipsis")
  }
  for (let n = start; n <= end; n += 1) {
    tokens.push(n)
  }
  if (end < pageCount - 1) {
    tokens.push("ellipsis")
  }
  tokens.push(pageCount)
  return tokens
}
