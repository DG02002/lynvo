import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLinks } from "~/features/links/use-links"
import type { LinkMetadata } from "~/features/links/types"

const { convexMutationMock, convexQueryMock, routeLoaderDataMock } = vi.hoisted(
  () => ({
    convexMutationMock: vi.fn(),
    convexQueryMock: vi.fn(),
    routeLoaderDataMock: vi.fn(),
  })
)

vi.mock("convex/react", () => ({
  useMutation: () => convexMutationMock,
  useQuery: convexQueryMock,
}))

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useRouteLoaderData: routeLoaderDataMock,
  }
})

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

const nativeSnapshot = {
  results: [
    {
      _id: "link-native",
      url: "https://example.com/native",
      title: "Native link",
      meta: JSON.stringify(metadata("native-file")),
      createdAt: 100,
      updatedAt: 100,
    },
  ],
}

describe("useLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeLoaderDataMock.mockReturnValue({ user: { sub: "user-1" } })
    convexQueryMock.mockReturnValue(nativeSnapshot)
    convexMutationMock.mockImplementation(async (input) =>
      "url" in input ? { id: "created-link" } : { success: true }
    )
  })

  it("renders the authoritative native Convex subscription", async () => {
    const { result } = renderHook(() => useLinks())

    await waitFor(() => expect(result.current.links).toHaveLength(1))
    expect(result.current.links[0]).toMatchObject({
      id: "link-native",
      title: "Native link",
    })
    expect(result.current.isLoading).toBe(false)
  })

  it("creates Saved links with an authenticated Convex mutation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    const { result } = renderHook(() => useLinks())

    let createdId: string | undefined
    await act(async () => {
      createdId = await result.current.actions.add(
        "https://example.com/created",
        { title: "Created link" }
      )
    })

    expect(createdId).toBe("created-link")
    expect(convexMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: expect.any(String),
        url: "https://example.com/created",
        title: "Created link",
        meta: expect.any(String),
      })
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("updates Saved link metadata through the Convex mutation contract", async () => {
    const { result } = renderHook(() => useLinks())
    await waitFor(() => expect(result.current.links).toHaveLength(1))

    act(() => {
      result.current.actions.markOpened(
        "https://example.com/native",
        "https://cdn.example.com/native-file"
      )
    })

    await waitFor(() =>
      expect(convexMutationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: expect.any(String),
          id: "link-native",
          operation: {
            kind: "markOpened",
            linkUrl: "https://cdn.example.com/native-file",
          },
        })
      )
    )
  })
})
