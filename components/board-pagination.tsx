"use client"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { paginationItems } from "@/lib/board-pagination"

export function BoardPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) {
    return null
  }

  function goTo(next: number, event: { preventDefault: () => void }) {
    event.preventDefault()
    onPageChange(next)
  }

  return (
    <Pagination aria-label="All services pages">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
            onClick={(event) => {
              if (page <= 1) {
                event.preventDefault()
                return
              }
              goTo(page - 1, event)
            }}
          />
        </PaginationItem>
        {paginationItems(page, pageCount).map((token, index) =>
          token === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={token}>
              <PaginationLink
                href="#"
                isActive={token === page}
                onClick={(event) => goTo(token, event)}
              >
                {token}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={page >= pageCount}
            className={
              page >= pageCount ? "pointer-events-none opacity-50" : undefined
            }
            onClick={(event) => {
              if (page >= pageCount) {
                event.preventDefault()
                return
              }
              goTo(page + 1, event)
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
