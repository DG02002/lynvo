import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useRefreshActions } from "~/features/links/use-link-actions/refresh-actions"
import type { RecentLinkViewItem } from "~/features/links/types"

describe("resolved mirror cache", () => {
  it("returns persisted mirrors without repeating extraction", async () => {
    const lazyItemUrl = "https://resolver.example/playable-item-one"
    const mirrors = [
      {
        url: "https://cdn.example/playable-item-one.mp4",
        label: "Play playable-item one",
        type: "file" as const,
      },
    ]
    const item: RecentLinkViewItem = {
      url: "https://source.example/show",
      timestamp: 1,
      metadata: {
        schemaVersion: 3,
        source: { pluginServerId: "plugin-server-one" },
        extraction: { extractedLinks: [] },
        playback: {
          watchedUrls: [],
          watchedIds: [],
          resolvedMirrors: { [lazyItemUrl]: mirrors },
        },
      },
    }
    const runWithExtractingItem = vi.fn(
      async <Value,>(_itemKey: string, task: () => Promise<Value>) => task()
    )
    const cacheResolvedMirrors = vi.fn()
    const { result } = renderHook(() =>
      useRefreshActions({
        recents: [item],
        updateRecentLinks: vi.fn(),
        cacheResolvedMirrors,
        openSelectionDialog: vi.fn(),
        extractingItems: new Set(),
        runWithExtractingItem,
      })
    )

    let resolved
    await act(async () => {
      resolved = await result.current.handleMirrorExpand(item.url, lazyItemUrl)
    })

    expect(resolved).toEqual(mirrors)
    expect(runWithExtractingItem).not.toHaveBeenCalled()
    expect(cacheResolvedMirrors).not.toHaveBeenCalled()
  })

  it("bypasses persisted mirrors when refresh is requested", async () => {
    const lazyItemUrl = "https://resolver.example/playable-item-one"
    const cachedMirrors = [
      {
        url: "https://cdn.example/cached.mp4",
        label: "Cached mirror",
        type: "file" as const,
      },
    ]
    const item: RecentLinkViewItem = {
      url: "https://source.example/show",
      timestamp: 1,
      metadata: {
        schemaVersion: 3,
        source: { pluginServerId: "plugin-server-one" },
        extraction: { extractedLinks: [] },
        playback: {
          watchedUrls: [],
          watchedIds: [],
          resolvedMirrors: { [lazyItemUrl]: cachedMirrors },
        },
      },
    }
    const runWithExtractingItem = vi.fn(async () => {
      throw new Error("cache bypass reached Plugin Server boundary")
    })
    const { result } = renderHook(() =>
      useRefreshActions({
        recents: [item],
        updateRecentLinks: vi.fn(),
        cacheResolvedMirrors: vi.fn(),
        openSelectionDialog: vi.fn(),
        extractingItems: new Set(),
        runWithExtractingItem,
      })
    )

    await expect(
      act(() => result.current.handleMirrorExpand(item.url, lazyItemUrl, true))
    ).rejects.toThrow("cache bypass reached Plugin Server boundary")

    expect(runWithExtractingItem).toHaveBeenCalledOnce()
  })
})
