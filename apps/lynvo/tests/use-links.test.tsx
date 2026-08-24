import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLinksWithRuntime } from "~/features/links/use-links"
import type { LinkMetadata } from "~/features/links/types"

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

const respondJson = <Body,>(body: Body, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  })

describe("useLinks", () => {
  beforeEach(() => {
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
