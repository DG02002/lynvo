import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useLinksPaginationAndSort } from "~/features/links/use-links/pagination"
import type { DraftListItem, SavedLinkListItem } from "~/features/links/types"

const createItem = (url: string, overrides: Partial<SavedLinkListItem> = {}) =>
  ({
    kind: "saved",
    url,
    timestamp: 1,
    ...overrides,
  }) satisfies SavedLinkListItem

describe("useLinksPaginationAndSort", () => {
  it("keeps drafts above saved links in every sort order", () => {
    const draft: DraftListItem = {
      kind: "draft",
      url: "https://example.com/draft",
      timestamp: 1,
      title: "Draft",
      meta: {},
      expiresAt: 10,
    }
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
