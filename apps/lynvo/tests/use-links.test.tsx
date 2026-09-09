import { act, renderHook, waitFor } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RealtimeContextValue } from "~/context/realtime-context"
import { useLinksWithRuntime } from "~/features/links/use-links"
import { clearLinksSnapshotStores } from "~/features/links/use-links/links-store"
import type { LinkMetadata, LinkViewItem } from "~/features/links/types"

const realtime = {
  status: "connected" as const,
  connectionGeneration: 1,
  subscribe: vi.fn(() => () => undefined),
}

const renderLinksHook = () =>
  renderHook(() =>
    useLinksWithRuntime({}, { user: { sub: "user-1" }, realtime })
  )

const metadata = (label: string): LinkMetadata => ({
  schemaVersion: 3,
  source: { title: label },
  extraction: {
    extractedLinks: [
      {
        nodeKey: `test:${label}`,
        id: label,
        url: `https://cdn.example.com/${label}`,
        label,
        type: "file",
        mediaNodeKind: "playable",
      },
    ],
  },
  playback: { openedUrls: [] },
})

const serverRecord = (
  id: string,
  overrides: Partial<{
    url: string
    title: string | null
    metaJson: string | null
    createdAt: number
    updatedAt: number
  }> = {}
) => ({
  id,
  url: overrides.url ?? `https://example.com/${id}`,
  title:
    overrides.title === undefined ? "Native link" : (overrides.title ?? null),
  metaJson:
    overrides.metaJson === undefined
      ? JSON.stringify(metadata("native-file"))
      : overrides.metaJson,
  createdAt: overrides.createdAt ?? 100,
  updatedAt: overrides.updatedAt ?? 100,
})

const fetchResponses = vi.fn()

vi.stubGlobal("fetch", vi.fn(fetchResponses))

const respondJson = <Body,>(body: Body, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  })

describe("useLinks", () => {
  beforeEach(() => {
    clearLinksSnapshotStores()
    vi.clearAllMocks()
    fetchResponses.mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path === "/api/data/links") {
        return respondJson(
          { links: [serverRecord("link-native")] },
          { "X-Lynvo-Data-Version": "5" }
        )
      }
      if (path === "/api/data/links/create-or-update") {
        return respondJson({
          id: "created-link",
          replayed: false,
          dataVersion: 6,
        })
      }
      if (path === "/api/data/links/apply-metadata-operation") {
        return respondJson({ success: true, replayed: false, dataVersion: 6 })
      }
      throw new Error(`Unexpected request: ${path}`)
    })
  })

  it("uses a server-rendered snapshot without a client refetch", () => {
    const initialItem: LinkViewItem = {
      id: "cached-link",
      url: "https://example.com/cached-link",
      timestamp: 100,
      metadata: metadata("cached-file"),
    }

    const { result } = renderHook(() =>
      useLinksWithRuntime(
        {
          initialItems: [initialItem],
          initialDataVersion: 5,
          hasInitialSnapshot: true,
        },
        { user: { sub: "cached-user" }, realtime }
      )
    )

    expect(result.current.links).toMatchObject([
      { id: "cached-link", kind: "saved" },
    ])
    expect(result.current.isLoading).toBe(false)
    expect(fetchResponses).not.toHaveBeenCalled()
  })

  it("uses the server snapshot before realtime connects", () => {
    const initialItem: LinkViewItem = {
      id: "cached-link",
      url: "https://example.com/cached-link",
      timestamp: 100,
      metadata: metadata("cached-file"),
    }
    const connectingRealtime = {
      ...realtime,
      status: "connecting" as const,
    }

    renderHook(() =>
      useLinksWithRuntime(
        {
          initialItems: [initialItem],
          initialDataVersion: 5,
          hasInitialSnapshot: true,
        },
        { user: { sub: "connecting-user" }, realtime: connectingRealtime }
      )
    )

    expect(fetchResponses).not.toHaveBeenCalled()
  })

  it("applies changed route items even when the data version is unchanged", async () => {
    const firstItem: LinkViewItem = {
      id: "first-link",
      url: "https://example.com/first-link",
      timestamp: 100,
      metadata: metadata("first-file"),
    }
    const nextItem: LinkViewItem = {
      id: "next-link",
      url: "https://example.com/next-link",
      timestamp: 100,
      metadata: metadata("next-file"),
    }
    const { result, rerender } = renderHook(
      ({ items }: { items: LinkViewItem[] }) =>
        useLinksWithRuntime(
          {
            initialItems: items,
            initialDataVersion: 5,
            hasInitialSnapshot: true,
          },
          { user: { sub: "same-version-user" }, realtime }
        ),
      { initialProps: { items: [firstItem] } }
    )

    expect(result.current.links[0]?.id).toBe("first-link")
    rerender({ items: [nextItem] })

    await waitFor(() => expect(result.current.links[0]?.id).toBe("next-link"))
    expect(fetchResponses).not.toHaveBeenCalled()
  })

  it("refreshes when realtime reports a newer data version", async () => {
    let notify: Parameters<RealtimeContextValue["subscribe"]>[0] | undefined
    const realtimeWithListener: RealtimeContextValue = {
      ...realtime,
      subscribe: vi.fn((listener) => {
        notify = listener
        return () => {
          if (notify === listener) {
            notify = undefined
          }
        }
      }),
    }

    renderHook(() =>
      useLinksWithRuntime(
        {
          initialItems: [],
          initialDataVersion: 5,
          hasInitialSnapshot: true,
        },
        {
          user: { sub: "realtime-version-user" },
          realtime: realtimeWithListener,
        }
      )
    )

    await waitFor(() => expect(notify).toBeTypeOf("function"))
    expect(fetchResponses).not.toHaveBeenCalled()

    act(() => {
      notify?.({ type: "data-changed", payload: { version: 6 } })
    })
    await waitFor(() => {
      expect(
        fetchResponses.mock.calls.filter(
          ([path]) => String(path) === "/api/data/links"
        )
      ).toHaveLength(1)
    })

    act(() => {
      notify?.({
        type: "session_hello",
        userId: "realtime-version-user",
        sessionId: "session-1",
        dataVersion: 7,
      })
    })
    await waitFor(() => {
      expect(
        fetchResponses.mock.calls.filter(
          ([path]) => String(path) === "/api/data/links"
        )
      ).toHaveLength(2)
    })
  })

  it("revalidates a cached snapshot when realtime is not connected", async () => {
    const initialItem: LinkViewItem = {
      id: "cached-link",
      url: "https://example.com/cached-link",
      timestamp: 100,
      metadata: metadata("cached-file"),
    }
    const connected = renderHook(() =>
      useLinksWithRuntime(
        {
          initialItems: [initialItem],
          initialDataVersion: 5,
          hasInitialSnapshot: true,
        },
        { user: { sub: "revalidate-user" }, realtime }
      )
    )
    connected.unmount()
    fetchResponses.mockClear()

    const offlineRealtime = {
      ...realtime,
      status: "connecting" as const,
    }
    renderHook(() =>
      useLinksWithRuntime(
        {},
        { user: { sub: "revalidate-user" }, realtime: offlineRealtime }
      )
    )

    await waitFor(() => {
      expect(
        fetchResponses.mock.calls.some(
          ([path]) => String(path) === "/api/data/links"
        )
      ).toBe(true)
    })
  })

  it("does not treat an authoritative empty snapshot as hydration", () => {
    const HydrationProbe = () => {
      const { isHydrating } = useLinksWithRuntime(
        {
          initialItems: [],
          initialDataVersion: 1,
          hasInitialSnapshot: true,
        },
        { user: { sub: "user-1" } }
      )

      return <span>{String(isHydrating)}</span>
    }

    expect(renderToString(<HydrationProbe />)).toContain("<span>false</span>")
  })

  it("renders the authoritative server snapshot", async () => {
    const { result } = renderLinksHook()

    await waitFor(() => expect(result.current.links).toHaveLength(1))
    expect(result.current.links[0]).toMatchObject({
      id: "link-native",
      title: "Native link",
      kind: "saved",
    })
    expect(result.current.isLoading).toBe(false)
  })

  it("creates links through the Worker API with a temporary prepend", async () => {
    const { result } = renderLinksHook()
    await waitFor(() => expect(result.current.links).toHaveLength(1))

    let createdId: string | undefined
    await act(async () => {
      createdId = await result.current.actions.add("https://example.com/new", {
        title: "Created link",
      })
    })

    expect(createdId).toBe("created-link")
    const createRequest = fetchResponses.mock.calls.find(
      ([path]) => String(path) === "/api/data/links/create-or-update"
    )
    if (!createRequest) {
      throw new Error("Create-link request was not sent")
    }
    const [, createRequestInit] = createRequest
    const payload = JSON.parse(String(createRequestInit.body))
    expect(payload).toMatchObject({
      url: "https://example.com/new",
      title: "Created link",
      operationId: expect.any(String),
    })
    await waitFor(() => {
      const visibleIds = result.current.links.map((item) => item.id)
      expect(visibleIds).toContain("link-native")
      expect(visibleIds).not.toContain(expect.stringMatching(/^temp:/))
    })
  })

  it("marks links opened through the metadata operation endpoint", async () => {
    const { result } = renderLinksHook()
    await waitFor(() => expect(result.current.links).toHaveLength(1))

    act(() => {
      result.current.actions.markOpened(
        "https://example.com/link-native",
        "https://cdn.example.com/native-file"
      )
    })

    await waitFor(() => {
      const metadataRequest = fetchResponses.mock.calls.find(
        ([path]) => String(path) === "/api/data/links/apply-metadata-operation"
      )
      if (!metadataRequest) {
        throw new Error("Metadata operation request was not sent")
      }
      const [, requestInit] = metadataRequest
      expect(JSON.parse(String(requestInit.body))).toMatchObject({
        id: "link-native",
        operation: {
          kind: "markOpened",
          linkUrl: "https://cdn.example.com/native-file",
        },
        operationId: expect.any(String),
      })
    })
    await waitFor(() => {
      expect(result.current.links[0]?.metadata.playback.openedUrls).toContain(
        "https://cdn.example.com/native-file"
      )
    })
  })
})
