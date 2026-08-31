import { describe, expect, it } from "vitest"
import { groupSaveListItems } from "~/components/save-list/save-list-groups"
import type { LinkListItem } from "~/features/links/types"

const createItem = (url: string, timestamp: number): LinkListItem => ({
  kind: "saved",
  id: url,
  url,
  timestamp,
  title: url,
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [] },
  },
})

describe("groupSaveListItems", () => {
  it("groups items into today, weekdays, and older links", () => {
    const currentDate = new Date(2026, 7, 23, 12, 0, 0)
    const todayLater = new Date(2026, 7, 23, 11, 0, 0).getTime()
    const todayEarlier = new Date(2026, 7, 23, 8, 0, 0).getTime()
    const yesterday = new Date(2026, 7, 22, 12, 0, 0).getTime()
    const older = new Date(2026, 7, 16, 12, 0, 0).getTime()

    const groups = groupSaveListItems(
      [
        createItem("https://example.com/older", older),
        createItem("https://example.com/today-earlier", todayEarlier),
        createItem("https://example.com/yesterday", yesterday),
        createItem("https://example.com/today-later", todayLater),
      ],
      currentDate.getTime()
    )

    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
        new Date(yesterday)
      ),
      "Older",
    ])
    expect(groups[0]?.items.map((item) => item.url)).toEqual([
      "https://example.com/today-later",
      "https://example.com/today-earlier",
    ])
    expect(groups[2]?.items.map((item) => item.url)).toEqual([
      "https://example.com/older",
    ])
  })

  it("keeps the complete date group together", () => {
    const currentTimeMs = new Date(2026, 7, 23, 12, 0, 0).getTime()
    const items = Array.from({ length: 11 }, (_, itemIndex) =>
      createItem(
        `https://example.com/today-${itemIndex}`,
        currentTimeMs - itemIndex * 60_000
      )
    )

    const groups = groupSaveListItems(items, currentTimeMs)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe("Today")
    expect(groups[0]?.items).toHaveLength(11)
    expect(groups[0]?.items[0]?.url).toBe("https://example.com/today-0")
    expect(groups[0]?.items.at(-1)?.url).toBe("https://example.com/today-10")
  })
})
