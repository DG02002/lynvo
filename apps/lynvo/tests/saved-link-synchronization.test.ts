import { describe, expect, it, vi } from "vitest"
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
  it("keeps a live snapshot when cached loading settles afterward", async () => {
    let resolveLoad: (items: LinkViewItem[]) => void = () => undefined
    const load = new Promise<LinkViewItem[]>((resolve) => {
      resolveLoad = resolve
    })
    const adapter = createAdapter()
    adapter.list = () => load
    const synchronization = createSavedLinkSynchronization(
      adapter,
      "user-one",
      [],
      { publish: vi.fn() }
    )

    const convergence = synchronization.synchronize({
      adapter,
      identity: "user-one",
      cachedItems: [],
      remote: { results: [createSavedLink(2)], version: 2, etag: "2" },
    })
    resolveLoad([{ url: "https://example.com/stale-cache", timestamp: 1 }])
    await convergence

    expect(synchronization.getSnapshot()[0]?.title).toBe("Remote title")
  })

  it("preserves locally resolved links while accepting a newer remote snapshot", async () => {
    const cachedItem: LinkViewItem = {
      id: "link-one",
      url: "https://example.com/one",
      timestamp: 1,
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            { url: "https://files.example/one", label: "Resolved file" },
          ],
        },
        playback: { openedIds: [], openedUrls: [] },
      },
    }
    const synchronization = createSavedLinkSynchronization(
      createAdapter([cachedItem]),
      "user-one",
      [cachedItem],
      { publish: vi.fn() }
    )

    await synchronization.synchronize({
      adapter: createAdapter([cachedItem]),
      identity: "user-one",
      cachedItems: [cachedItem],
      remote: {
        results: [createSavedLink(2)],
        version: 2,
        etag: "2",
      },
    })

    expect(synchronization.getSnapshot()[0]).toMatchObject({
      title: "Remote title",
      metadata: {
        extraction: {
          extractedLinks: cachedItem.metadata.extraction.extractedLinks,
        },
      },
    })
  })

  it("rejects an older remote snapshot through the same interface", async () => {
    const synchronization = createSavedLinkSynchronization(
      createAdapter(),
      "user-one",
      [],
      { publish: vi.fn() }
    )

    const adapter = createAdapter()
    await synchronization.synchronize({
      adapter,
      identity: "user-one",
      cachedItems: [],
      remote: { results: [createSavedLink(2)], version: 2, etag: "2" },
    })
    await synchronization.synchronize({
      adapter,
      identity: "user-one",
      cachedItems: [],
      remote: {
        results: [{ ...createSavedLink(1), title: "Stale" }],
        version: 1,
        etag: "1",
      },
    })

    expect(synchronization.getSnapshot()[0]?.title).toBe("Remote title")
  })

  it("resets cached state when the signed-in identity changes", async () => {
    const synchronization = createSavedLinkSynchronization(
      createAdapter(),
      "user-one",
      [],
      { publish: vi.fn() }
    )
    await synchronization.synchronize({
      adapter: createAdapter(),
      identity: "user-one",
      cachedItems: [],
      remote: { results: [createSavedLink(2)], version: 2, etag: "2" },
    })
    const userTwoItem: LinkViewItem = {
      url: "https://example.com/user-two",
      timestamp: 3,
    }

    await synchronization.synchronize({
      adapter: createAdapter([userTwoItem]),
      identity: "user-two",
      cachedItems: [userTwoItem],
    })

    expect(synchronization.getSnapshot()).toEqual([userTwoItem])
  })
})
