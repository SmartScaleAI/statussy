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

  return (
    <Pagination aria-label="All services pages">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            disabled={page <= 1}
            onClick={() => {
              if (page <= 1) return
              onPageChange(page - 1)
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
                isActive={token === page}
                onClick={() => onPageChange(token)}
              >
                {token}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            disabled={page >= pageCount}
            onClick={() => {
              if (page >= pageCount) return
              onPageChange(page + 1)
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
