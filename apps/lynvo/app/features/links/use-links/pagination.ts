import { useState } from "react"
import type { LinkViewItem } from "~/features/links/types"

const ITEMS_PER_PAGE = 10

export function useLinksPaginationAndSort(links: LinkViewItem[]) {
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const filteredLinks = links.filter((item) => {
    if (!searchQuery) {
      return true
    }
    const q = searchQuery.toLowerCase()
    return (
      (item.title || item.url).toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q)
    )
  })

  const sortedLinks = filteredLinks.toSorted((a, b) => {
    if (sortOrder === "newest") {
      return b.timestamp - a.timestamp
    }
    return a.timestamp - b.timestamp
  })

  const totalPages = Math.ceil(sortedLinks.length / ITEMS_PER_PAGE)

  let adjustedPage = currentPage
  if (currentPage > totalPages && totalPages > 0) {
    adjustedPage = totalPages
    setCurrentPage(totalPages)
  }

  const paginatedLinks = sortedLinks.slice(
    (adjustedPage - 1) * ITEMS_PER_PAGE,
    adjustedPage * ITEMS_PER_PAGE
  )

  return {
    paginatedLinks,
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
