import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { LinkViewItem } from "~/features/links/types"
import { useRefreshActions } from "~/features/links/use-link-actions/refresh-actions"
import { extractionOrchestration } from "~/lib/extraction/orchestration"

describe("link refresh actions", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("records the next attempt when a saved link is refreshed", async () => {
    const item: LinkViewItem = {
      url: "https://source.example/show",
      timestamp: 1,
      metadata: {
        schemaVersion: 3,
        source: { pluginServerId: "plugin-server-one" },
        extraction: { extractedLinks: [] },
        playback: { openedUrls: [] },
        debugLog: [
          {
            at: 1,
            outcome: "failed",
            attempt: 1,
          },
        ],
      },
    }
    const updatedLinks = [
      {
        url: "https://cdn.example/show.mp4",
        label: "Show",
        type: "file" as const,
        mediaNodeKind: "playable" as const,
      },
    ]
    vi.spyOn(extractionOrchestration, "refreshSource").mockResolvedValue(
      updatedLinks
    )
    const updateLinks = vi.fn()
    const { result } = renderHook(() =>
      useRefreshActions({
        links: [{ ...item, kind: "saved" }],
        updateLinks,
        appendDebugLog: vi.fn(),
        cacheResolvedMirrors: vi.fn(),
        openSelectionDialog: vi.fn(),
        extractingItems: new Set(),
        runWithExtractingItem: async (_itemKey, task) => task(),
        ensureSessionIdentity: async () => true,
      })
    )

    await act(async () => {
      await result.current.handleSoftRefresh(item.url)
    })

    expect(updateLinks).toHaveBeenCalledWith(
      item.url,
      updatedLinks,
      expect.objectContaining({ outcome: "complete", attempt: 2 })
    )
  })

  it("returns persisted mirrors without repeating extraction", async () => {
    const lazyItemUrl = "https://resolver.example/playable-item-one"
    const mirrors = [
      {
        url: "https://cdn.example/playable-item-one.mp4",
        label: "Play playable-item one",
        type: "file" as const,
      },
    ]
    const item: LinkViewItem = {
      url: "https://source.example/show",
      timestamp: 1,
      metadata: {
        schemaVersion: 3,
        source: { pluginServerId: "plugin-server-one" },
        extraction: { extractedLinks: [] },
        playback: {
          openedUrls: [],
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
        links: [{ ...item, kind: "saved" }],
        updateLinks: vi.fn(),
        appendDebugLog: vi.fn(),
        cacheResolvedMirrors,
        openSelectionDialog: vi.fn(),
        extractingItems: new Set(),
        runWithExtractingItem,
        ensureSessionIdentity: async () => true,
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
    const item: LinkViewItem = {
      url: "https://source.example/show",
      timestamp: 1,
      metadata: {
        schemaVersion: 3,
        source: { pluginServerId: "plugin-server-one" },
        extraction: { extractedLinks: [] },
        playback: {
          openedUrls: [],
          resolvedMirrors: { [lazyItemUrl]: cachedMirrors },
        },
      },
    }
    const runWithExtractingItem = vi.fn(async () => {
      throw new Error("cache bypass reached Plugin Server boundary")
    })
    const { result } = renderHook(() =>
      useRefreshActions({
        links: [{ ...item, kind: "saved" }],
        updateLinks: vi.fn(),
        appendDebugLog: vi.fn(),
        cacheResolvedMirrors: vi.fn(),
        openSelectionDialog: vi.fn(),
        extractingItems: new Set(),
        runWithExtractingItem,
        ensureSessionIdentity: async () => true,
      })
    )

    await expect(
      act(() => result.current.handleMirrorExpand(item.url, lazyItemUrl, true))
    ).rejects.toThrow("cache bypass reached Plugin Server boundary")

    expect(runWithExtractingItem).toHaveBeenCalledOnce()
  })
})
