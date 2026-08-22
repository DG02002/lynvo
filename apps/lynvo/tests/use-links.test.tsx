import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLinks } from "~/features/links/use-links"
import type { LinkMetadata } from "~/features/links/types"

const { routeLoaderDataMock, realtimeMock } = vi.hoisted(() => ({
  routeLoaderDataMock: vi.fn(),
  realtimeMock: {
    status: "connected",
    connectionGeneration: 1,
    subscribe: vi.fn(() => () => undefined),
  },
}))

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useRouteLoaderData: routeLoaderDataMock,
  }
})

vi.mock("~/context/RealtimeContext", () => ({
  useOptionalRealtime: () => realtimeMock,
}))

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
  playback: { openedUrls: [], openedIds: [] },
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

const respondJson = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  })

describe("useLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeLoaderDataMock.mockReturnValue({ user: { sub: "user-1" } })
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

  it("renders the authoritative server snapshot", async () => {
    const { result } = renderHook(() => useLinks())

    await waitFor(() => expect(result.current.links).toHaveLength(1))
    expect(result.current.links[0]).toMatchObject({
      id: "link-native",
      title: "Native link",
      kind: "saved",
    })
    expect(result.current.isLoading).toBe(false)
  })

  it("creates links through the Worker API with a temporary prepend", async () => {
    const { result } = renderHook(() => useLinks())
    await waitFor(() => expect(result.current.links).toHaveLength(1))

    let createdId: string | undefined
    await act(async () => {
      createdId = await result.current.actions.add("https://example.com/new", {
        title: "Created link",
      })
    })

    expect(createdId).toBe("created-link")
    const [, createRequestInit] = fetchResponses.mock.calls.find(
      ([path]) => String(path) === "/api/data/links/create-or-update"
    ) as [string, RequestInit]
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
    const { result } = renderHook(() => useLinks())
    await waitFor(() => expect(result.current.links).toHaveLength(1))

    act(() => {
      result.current.actions.markOpened(
        "https://example.com/link-native",
        "https://cdn.example.com/native-file"
      )
    })

    await waitFor(() => {
      const [, requestInit] = fetchResponses.mock.calls.find(
        ([path]) => String(path) === "/api/data/links/apply-metadata-operation"
      ) as [string, RequestInit]
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
      expect(
        result.current.links[0]?.metadata.playback.openedUrls
      ).toContain("https://cdn.example.com/native-file")
    })
  })
})
