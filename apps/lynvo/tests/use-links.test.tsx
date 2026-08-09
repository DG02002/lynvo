import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { PropsWithChildren } from "react"
import { renderToString } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLinks } from "~/features/links/use-links"
import type { LinkMetadata } from "~/features/links/types"

const { routeLoaderDataMock } = vi.hoisted(() => ({
  routeLoaderDataMock: vi.fn(),
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
    openedUrls: [],
    openedIds: [],
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

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useLinks", () => {
  let storage: Storage

  beforeEach(() => {
    storage = installLocalStorage()
    vi.clearAllMocks()
    routeLoaderDataMock.mockReturnValue({ user: { sub: "user-1" } })
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => undefined)
    )
  })

  it("hydrates signed-in links from cache once while waiting for Convex", () => {
    storage.setItem(
      "lynvo:links:sync:v1:user-1",
      JSON.stringify({
        results: [cacheEntry],
        version: 100,
        etag: "100",
      })
    )
    const { getItem, setItem } = storage
    vi.mocked(setItem).mockClear()

    const { result } = renderHook(() => useLinks(), {
      wrapper: createWrapper(),
    })

    expect(result.current.links).toHaveLength(1)
    expect(result.current.links[0].title).toBe("Cached link")
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isHydrating).toBe(false)
    expect(getItem).toHaveBeenCalledTimes(2)
    expect(setItem).not.toHaveBeenCalled()
  })

  it("uses the same empty links snapshot as the server during hydration", () => {
    storage.setItem(
      "lynvo:links:sync:v1:user-1",
      JSON.stringify({
        results: [cacheEntry],
        version: 100,
        etag: "100",
      })
    )

    const Probe = () => {
      const { isHydrating, links } = useLinks()
      return <span>{`${links.length}:${isHydrating}`}</span>
    }

    const Wrapper = createWrapper()
    expect(
      renderToString(
        <Wrapper>
          <Probe />
        </Wrapper>
      )
    ).toBe("<span>0:true</span>")
  })

  it("updates cached links when the Worker returns live links", async () => {
    storage.setItem(
      "lynvo:links:sync:v1:user-1",
      JSON.stringify({
        results: [cacheEntry],
        version: 100,
        etag: "100",
      })
    )
    const { setItem } = storage
    vi.mocked(setItem).mockClear()

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            _id: "link-live",
            url: "https://example.com/live",
            title: "Live link",
            meta: JSON.stringify(metadata("live-file")),
            createdAt: 200,
            updatedAt: 250,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const { result } = renderHook(() => useLinks(), {
      wrapper: createWrapper(),
    })

    expect(result.current.links[0].title).toBe("Cached link")

    await waitFor(() => {
      expect(result.current.links[0].title).toBe("Live link")
    })
    expect(setItem).toHaveBeenCalledWith(
      "lynvo:links:sync:v1:user-1",
      expect.stringContaining("Live link")
    )
  })

  it("creates authenticated links through the Worker", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const request = input instanceof Request ? input : undefined
      const method = request?.method ?? init?.method ?? "GET"
      if (method === "POST") {
        return new Response(JSON.stringify("link-worker"), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
    const { result } = renderHook(() => useLinks(), {
      wrapper: createWrapper(),
    })

    let createdId: string | undefined
    await act(async () => {
      createdId = await result.current.actions.add(
        "https://example.com/worker",
        { title: "Worker link" }
      )
    })

    expect(createdId).toBe("link-worker")
    const createCall = vi.mocked(fetch).mock.calls.find(([input, init]) => {
      const requestMethod = input instanceof Request ? input.method : undefined
      return (requestMethod ?? init?.method) === "POST"
    })
    if (!createCall) {
      throw new Error("Expected a Worker create request")
    }
    const [input, init] = createCall
    const requestUrl = input instanceof Request ? input.url : String(input)
    const requestBody =
      input instanceof Request ? input.clone().body : init?.body
    if (!requestBody) {
      throw new Error("Expected a JSON request body")
    }
    expect(requestUrl).toContain("/api/links")
    await expect(new Response(requestBody).json()).resolves.toEqual(
      expect.objectContaining({
        url: "https://example.com/worker",
        title: "Worker link",
      })
    )
  })

  it("removes undefined metadata fields before sending an update", async () => {
    storage.setItem(
      "lynvo:links:sync:v1:user-1",
      JSON.stringify({
        results: [cacheEntry],
        version: 100,
        etag: "100",
      })
    )
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const request = input instanceof Request ? input : undefined
      const method = request?.method ?? init?.method ?? "GET"
      if (method === "POST") {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return await new Promise<Response>(() => undefined)
    })
    const { result } = renderHook(() => useLinks(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.links).toHaveLength(1)
    })
    act(() => {
      result.current.actions.markOpened(
        cacheEntry.url,
        cacheEntry.url
      )
    })

    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.filter(([input, init]) => {
          const method = input instanceof Request ? input.method : init?.method
          return method === "POST"
        })
      ).toHaveLength(1)
    })
    const updateCall = vi.mocked(fetch).mock.calls.find(([input, init]) => {
      const method = input instanceof Request ? input.method : init?.method
      return method === "POST"
    })
    expect(updateCall).toBeDefined()
    const [input, init] = updateCall!
    const requestBody = input instanceof Request ? input.clone().body : init?.body
    expect(requestBody).toBeDefined()
    await expect(new Response(requestBody).json()).resolves.not.toHaveProperty(
      "meta.source.pluginIcon"
    )
  })
})
