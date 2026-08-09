import { describe, expect, it } from "vitest"
import type { LinkViewItem } from "~/features/links/types"
import type { SavedLink } from "~/features/links/links.mapper"
import { createSavedLinkSynchronization } from "~/features/links/use-links/synchronization"

const createAdapter = (
  items: LinkViewItem[] = []
): LinksPersistenceAdapter => ({
  list: async () => items,
  add: async (item) => item,
  update: async (item) => item,
  delete: async () => undefined,
  clear: async () => undefined,
})

const createSavedLink = (updatedAt: number): SavedLink => ({
  id: "link-one",
  url: "https://example.com/one",
  title: "Remote title",
  createdAt: 1,
  updatedAt,
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedIds: [], openedUrls: [] },
  },
})

describe("saved link synchronization", () => {
  it("preserves locally resolved links while accepting a newer remote snapshot", () => {
    const cachedItem: LinkViewItem = {
      id: "link-one",
      url: "https://example.com/one",
      timestamp: 1,
      extractedLinks: [
        { url: "https://files.example/one", label: "Resolved file" },
      ],
    }
    const synchronization = createSavedLinkSynchronization(
      createAdapter([cachedItem]),
      "user-one",
      [cachedItem]
    )

    synchronization.acceptRemote([createSavedLink(2)], 2)

    expect(synchronization.getSnapshot()[0]).toMatchObject({
      title: "Remote title",
      extractedLinks: cachedItem.extractedLinks,
    })
  })

  it("rejects an older remote snapshot through the same interface", () => {
    const synchronization = createSavedLinkSynchronization(
      createAdapter(),
      "user-one",
      []
    )

    synchronization.acceptRemote([createSavedLink(2)], 2)
    synchronization.acceptRemote([{ ...createSavedLink(1), title: "Stale" }], 1)

    expect(synchronization.getSnapshot()[0]?.title).toBe("Remote title")
  })

  it("resets cached state when the signed-in identity changes", () => {
    const synchronization = createSavedLinkSynchronization(
      createAdapter(),
      "user-one",
      []
    )
    synchronization.acceptRemote([createSavedLink(2)], 2)
    const userTwoItem: LinkViewItem = {
      url: "https://example.com/user-two",
      timestamp: 3,
    }

    synchronization.connect(createAdapter([userTwoItem]), "user-two", [
      userTwoItem,
    ])

    expect(synchronization.getSnapshot()).toEqual([userTwoItem])
  })
})
