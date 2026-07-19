import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useRecentLinks } from "~/features/links/use-recent-links"
import type { LinkMetadataV2 } from "~/features/links/types"

const { routeLoaderDataMock, convexQueryMock, convexMutationMock } = vi.hoisted(
  () => ({
    routeLoaderDataMock: vi.fn(),
    convexQueryMock: vi.fn(),
    convexMutationMock: vi.fn(() => vi.fn()),
  })
)

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useRouteLoaderData: routeLoaderDataMock,
  }
})

vi.mock("convex/react", () => ({
  useQuery: convexQueryMock,
  useMutation: convexMutationMock,
}))

const metadata = (label: string): LinkMetadataV2 => ({
  schemaVersion: 2,
  source: {
    title: label,
  },
  extraction: {
    extractedLinks: [
      {
        id: label,
        url: `https://cdn.example.com/${label}`,
        label,
        type: "file",
      },
    ],
  },
  playback: {
    watchedUrls: [],
    watchedIds: [],
  },
})

const cacheEntry = {
  id: "link-cache",
  url: "https://example.com/cache",
  title: "Cached link",
  createdAt: 100,
  updatedAt: 100,
  metadata: metadata("cached-file"),
}

function installLocalStorage() {
  const values = new Map<string, string>()
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
    clear: vi.fn(() => {
      values.clear()
    }),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    get length() {
      return values.size
    },
  } satisfies Storage

  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  })
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  })

  return storage
}

describe("useRecentLinks", () => {
  let storage: Storage

  beforeEach(() => {
    storage = installLocalStorage()
    vi.clearAllMocks()
    routeLoaderDataMock.mockReturnValue({ user: { sub: "user-1" } })
    convexQueryMock.mockReturnValue(undefined)
    convexMutationMock.mockReturnValue(vi.fn())
  })

  it("hydrates signed-in recents from cache once while waiting for Convex", () => {
    storage.setItem(
      "sl2jp:recents:sync:v1:user-1",
      JSON.stringify({
        results: [cacheEntry],
        version: 100,
        etag: "100",
      })
    )
    const { getItem, setItem } = storage
    vi.mocked(setItem).mockClear()

    const { result } = renderHook(() => useRecentLinks())

    expect(result.current.recents).toHaveLength(1)
    expect(result.current.recents[0].title).toBe("Cached link")
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isHydrating).toBe(false)
    expect(getItem).toHaveBeenCalledTimes(2)
    expect(setItem).not.toHaveBeenCalled()
  })

  it("updates cached recents only when Convex returns live links", async () => {
    storage.setItem(
      "sl2jp:recents:sync:v1:user-1",
      JSON.stringify({
        results: [cacheEntry],
        version: 100,
        etag: "100",
      })
    )
    const { setItem } = storage
    vi.mocked(setItem).mockClear()

    const { result, rerender } = renderHook(() => useRecentLinks())

    expect(result.current.recents[0].title).toBe("Cached link")

    convexQueryMock.mockReturnValue([
      {
        _id: "link-live",
        _creationTime: 200,
        userId: "user-1",
        url: "https://example.com/live",
        title: "Live link",
        meta: JSON.stringify(metadata("live-file")),
        createdAt: 200,
        updatedAt: 250,
      },
    ])
    rerender()

    await waitFor(() => {
      expect(result.current.recents[0].title).toBe("Live link")
    })
    expect(setItem).toHaveBeenCalledWith(
      "sl2jp:recents:sync:v1:user-1",
      expect.stringContaining("Live link")
    )
  })

  it("replaces rather than merges collections across identity changes", async () => {
    storage.setItem(
      "sl2jp:recents:v1",
      JSON.stringify([
        {
          url: "https://example.com/anonymous",
          title: "Anonymous link",
          timestamp: 50,
        },
      ])
    )
    storage.setItem(
      "sl2jp:recents:sync:v1:user-1",
      JSON.stringify({ results: [cacheEntry], version: 100, etag: "100" })
    )
    routeLoaderDataMock.mockReturnValue({ user: null })
    const { result, rerender } = renderHook(() => useRecentLinks())

    expect(result.current.recents.map(({ title }) => title)).toEqual([
      "Anonymous link",
    ])

    routeLoaderDataMock.mockReturnValue({ user: { sub: "user-1" } })
    rerender()
    await waitFor(() => {
      expect(result.current.recents.map(({ title }) => title)).toEqual([
        "Cached link",
      ])
    })

    routeLoaderDataMock.mockReturnValue({ user: null })
    rerender()
    await waitFor(() => {
      expect(result.current.recents.map(({ title }) => title)).toEqual([
        "Anonymous link",
      ])
    })
  })

  it("removes corrupt local storage and recovers with an empty collection", () => {
    storage.setItem("sl2jp:recents:v1", "not-json")
    routeLoaderDataMock.mockReturnValue({ user: null })

    const { result } = renderHook(() => useRecentLinks())

    expect(result.current.recents).toEqual([])
    expect(storage.getItem("sl2jp:recents:v1")).toBeNull()
  })
})
