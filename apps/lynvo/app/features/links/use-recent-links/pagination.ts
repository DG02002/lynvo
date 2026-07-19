import { useState } from "react"
import type { RecentLinkViewItem } from "~/features/links/types"

const ITEMS_PER_PAGE = 10

export function useRecentLinksPaginationAndSort(recents: RecentLinkViewItem[]) {
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const filteredRecents = recents.filter((item) => {
    if (!searchQuery) {
      return true
    }
    const q = searchQuery.toLowerCase()
    return (
      (item.title || item.url).toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q)
    )
  })

  const sortedRecents = filteredRecents.toSorted((a, b) => {
    if (sortOrder === "newest") {
      return b.timestamp - a.timestamp
    }
    return a.timestamp - b.timestamp
  })

  const totalPages = Math.ceil(sortedRecents.length / ITEMS_PER_PAGE)

  let adjustedPage = currentPage
  if (currentPage > totalPages && totalPages > 0) {
    adjustedPage = totalPages
    setCurrentPage(totalPages)
  }

  const paginatedRecents = sortedRecents.slice(
    (adjustedPage - 1) * ITEMS_PER_PAGE,
    adjustedPage * ITEMS_PER_PAGE
  )

  return {
    paginatedRecents,
    totalPages,
    currentPage,
    setCurrentPage,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    highlightedId,
    setHighlightedId,
  }
}
