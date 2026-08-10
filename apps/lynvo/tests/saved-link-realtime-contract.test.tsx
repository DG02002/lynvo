import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import type { SavedLink } from "~/features/links/links.mapper"
import type { LinkViewItem } from "~/features/links/types"
import { createSavedLinkSynchronization } from "~/features/links/use-links/synchronization"
import { savedLinksQueryKey } from "~/features/links/use-links/query"

interface FakeSavedLinkServer {
  revision: number
  results: SavedLink[]
}

const metadata = {
  schemaVersion: 3 as const,
  source: {},
  extraction: { extractedLinks: [] },
  playback: { openedIds: [], openedUrls: [] },
}

const adapter = (): LinksPersistenceAdapter => ({
  list: async () => [],
  add: async (item) => item,
  update: async (item) => item,
  delete: async () => undefined,
  clear: async () => undefined,
})

const createClient = (identity: string) => ({
  identity,
  revision: 0,
  queryClient: new QueryClient(),
  synchronization: createSavedLinkSynchronization(adapter(), identity, [], {
    publish: () => undefined,
  }),
})

describe("Saved link realtime contract", () => {
  it("converges Saved links across two active account sessions", async () => {
    const server: FakeSavedLinkServer = { revision: 0, results: [] }
    const browserA = createClient("account-one")
    const browserB = createClient("account-one")

    const refresh = async (browser: ReturnType<typeof createClient>) => {
      const snapshot = await browser.queryClient.fetchQuery({
        queryKey: savedLinksQueryKey(browser.identity, 1),
        queryFn: async () => structuredClone(server),
      })
      browser.revision = snapshot.revision
      await browser.synchronization.synchronize({
        adapter: adapter(),
        identity: browser.identity,
        cachedItems: [],
        remote: {
          revision: snapshot.revision,
          results: snapshot.results,
          etag: String(snapshot.revision),
        },
      })
    }
    const deliver = async (
      browser: ReturnType<typeof createClient>,
      revision: number
    ) => {
      if (revision > browser.revision) await refresh(browser)
    }
    const commit = (results: SavedLink[]) => {
      server.revision += 1
      server.results = results
      return server.revision
    }

    await Promise.all([refresh(browserA), refresh(browserB)])
    expect(browserB.synchronization.getSnapshot()).toEqual([])

    const linkA: SavedLink = {
      id: "link-a",
      url: "https://example.com/a",
      title: "A",
      createdAt: 1,
      updatedAt: 10,
      metadata,
    }
    await deliver(browserB, commit([linkA]))
    expect(browserB.synchronization.getSnapshot()[0]?.title).toBe("A")

    const updated = { ...linkA, title: "Updated", updatedAt: 11 }
    const updateRevision = commit([updated])
    await deliver(browserB, updateRevision)
    expect(browserB.synchronization.getSnapshot()[0]?.title).toBe("Updated")

    const newest: SavedLink = {
      ...linkA,
      id: "link-b",
      url: "https://example.com/b",
      title: "Newest",
      updatedAt: 100,
    }
    await deliver(browserB, commit([updated, newest]))
    await deliver(browserB, commit([updated]))
    expect(
      browserB.synchronization.getSnapshot().map((item) => item.id)
    ).toEqual(["link-a"])

    const clearRevision = commit([])
    await deliver(browserB, clearRevision)
    await deliver(browserB, clearRevision)
    await deliver(browserB, clearRevision - 1)
    expect(browserB.synchronization.getSnapshot()).toEqual([])

    const droppedRevision = commit([linkA])
    expect(browserB.revision).toBeLessThan(droppedRevision)
    if (server.revision > browserB.revision) await refresh(browserB)
    expect(browserB.synchronization.getSnapshot()[0]?.id).toBe("link-a")

    const disconnectedRevision = commit([updated])
    await deliver(browserB, disconnectedRevision)
    expect(browserB.synchronization.getSnapshot()[0]?.title).toBe("Updated")

    const pendingOldAccountRefresh = refresh(browserB)
    browserB.identity = "account-two"
    browserB.synchronization = createSavedLinkSynchronization(
      adapter(),
      browserB.identity,
      []
    )
    server.results = []
    await pendingOldAccountRefresh
    await refresh(browserB)
    expect(browserB.synchronization.getSnapshot()).toEqual([])
  })
})
