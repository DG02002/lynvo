import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useLinksQuery } from "~/features/links/use-links/query"

const { convexQueryMock } = vi.hoisted(() => ({
  convexQueryMock: vi.fn(),
}))

vi.mock("convex/react", () => ({
  useQuery: convexQueryMock,
}))

describe("native Convex Saved links query", () => {
  it("maps the authenticated subscription result into the Saved link contract", () => {
    convexQueryMock.mockReturnValue({
      revision: 4,
      results: [
        {
          _id: "saved-link-id",
          url: "https://example.com/source",
          title: "Source",
          meta: JSON.stringify({
            schemaVersion: 3,
            source: {},
            extraction: { extractedLinks: [] },
            playback: { openedUrls: [], openedIds: [], resolvedMirrors: {} },
          }),
          createdAt: 10,
          updatedAt: 20,
        },
      ],
    })

    const { result } = renderHook(() => useLinksQuery("user-one"))

    expect(result.current.isLive).toBe(true)
    expect(result.current.data).toMatchObject({
      revision: 4,
      results: [
        {
          id: "saved-link-id",
          url: "https://example.com/source",
          title: "Source",
        },
      ],
    })
  })

  it("skips the subscription for a signed-out browser", () => {
    convexQueryMock.mockReturnValue(undefined)

    const { result } = renderHook(() => useLinksQuery(undefined))

    expect(convexQueryMock.mock.calls.at(-1)?.[1]).toBe("skip")
    expect(result.current.isLoading).toBe(false)
  })
})
