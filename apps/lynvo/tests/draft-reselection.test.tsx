import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useRefreshActions } from "~/features/links/use-link-actions/refresh-actions"
import type { DraftListItem } from "~/features/links/types"

describe("draft selection", () => {
  it("opens the stored draft tree without running extraction again", async () => {
    const item: DraftListItem = {
      kind: "draft",
      url: "https://source-alpha.example/folder-alpha/",
      timestamp: 1,
      title: "SH3LBY",
      expiresAt: 10,
      extractedLinks: [
        {
          id: "stored-file",
          url: "https://source-alpha.example/folder-alpha/file.mkv",
          label: "file.mkv",
          type: "file",
        },
      ],
      meta: {
        pluginName: "Bhadoo’s Google Drive Index",
        pageTitle: "SH3LBY",
      },
    }
    const openSelectionDialog = vi.fn()
    const runWithExtractingItem = vi.fn(async () => {
      throw new Error("draft reached extraction")
    })
    const { result } = renderHook(() =>
      useRefreshActions({
        links: [item],
        updateLinks: vi.fn(),
        cacheResolvedMirrors: vi.fn(),
        openSelectionDialog,
        extractingItems: new Set(),
        runWithExtractingItem,
      })
    )

    await act(() => result.current.handleShowLinks(item.url))

    expect(runWithExtractingItem).not.toHaveBeenCalled()
    expect(openSelectionDialog).toHaveBeenCalledWith({
      originalUrl: item.url,
      links: item.extractedLinks,
      meta: item.meta,
      isDraftMode: true,
    })
  })
})
