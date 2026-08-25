import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTitleGroupsWithRuntime } from "~/features/links/title-grouping/use-title-groups"

const listTitleGroups = vi.fn()
const runtime: UseTitleGroupsRuntime = {
  userId: "user-1",
  dataSource: { list: listTitleGroups },
}

const createProjection = (displayTitle: string): TitleProjection => ({
  dateGroups: [
    {
      key: "today",
      label: "Today",
      groups: [
        {
          identityKey: `movie:${displayTitle.toLowerCase()}:2026`,
          mediaKind: "movie",
          displayTitle,
          year: 2026,
          metadataState: "unavailable",
          lastAddedAt: 1,
          sourceCount: 0,
          entries: [],
        },
      ],
    },
  ],
  unmatchedGroups: [],
})

describe("useTitleGroups", () => {
  beforeEach(() => {
    listTitleGroups.mockReset()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("keeps the last projection through a failed refresh after leaving Library mode", async () => {
    const cachedProjection = createProjection("Cached library")
    listTitleGroups
      .mockResolvedValueOnce({ projection: cachedProjection, dataVersion: 1 })
      .mockRejectedValueOnce(new Error("offline"))

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useTitleGroupsWithRuntime({ enabled, dataVersion: 1 }, runtime),
      { initialProps: { enabled: true } }
    )

    await waitFor(() =>
      expect(result.current.projection).toEqual(cachedProjection)
    )

    act(() => rerender({ enabled: false }))
    act(() => rerender({ enabled: true }))

    await waitFor(() =>
      expect(result.current.error).toBe("Unable to load media library")
    )
    expect(result.current.projection).toEqual(cachedProjection)
  })
})
