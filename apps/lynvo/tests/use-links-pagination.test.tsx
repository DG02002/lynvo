import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useLinksPaginationAndSort } from "~/features/links/use-links/pagination"
import type { LinkViewItem } from "~/features/links/types"

const createItem = (url: string, overrides: Partial<LinkViewItem> = {}) =>
  ({ url, timestamp: 1, ...overrides }) satisfies LinkViewItem

describe("useLinksPaginationAndSort", () => {
  it("keeps drafts above saved links in every sort order", () => {
    const draft = createItem("https://example.com/draft", {
      isDraft: true,
      timestamp: 1,
    })
    const savedLink = createItem("https://example.com/saved", {
      timestamp: 2,
    })
    const { result } = renderHook(() =>
      useLinksPaginationAndSort([savedLink, draft])
    )

    expect(result.current.paginatedLinks.map((item) => item.url)).toEqual([
      draft.url,
      savedLink.url,
    ])

    act(() => result.current.setSortOrder("oldest"))

    expect(result.current.paginatedLinks.map((item) => item.url)).toEqual([
      draft.url,
      savedLink.url,
    ])
  })
})
