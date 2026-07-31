import { describe, expect, it, vi } from "vitest"
import type { RecentLinkViewItem } from "~/features/links/types"
import {
  createServerRecentLinksAdapter,
  createLocalRecentLinksAdapter,
  createRecentLinksPersistence,
} from "~/features/links/use-recent-links/persistence"

const item = (url: string, id?: string): RecentLinkViewItem => ({
  id,
  url,
  title: url,
  timestamp: 1,
})

const runAdapterContract = async (
  createAdapter: () => RecentLinksPersistenceAdapter
) => {
  const adapter = createAdapter()
  const first = item("https://example.com/first", "first")
  const replacement = { ...first, title: "Replacement" }
  const second = item("https://example.com/second", "second")

  expect(await adapter.list()).toEqual([])
  await adapter.add(first)
  await adapter.add(second)
  await adapter.add(replacement)
  expect(await adapter.list()).toEqual([replacement, second])
  await adapter.update({ ...replacement, title: "Updated" })
  expect((await adapter.list())[0].title).toBe("Updated")
  await adapter.delete(second)
  expect(await adapter.list()).toHaveLength(1)
  await adapter.clear()
  expect(await adapter.list()).toEqual([])
}

describe("Recent Links persistence adapters", () => {
  it("applies the common contract to local browser storage", async () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }
    const read = () => JSON.parse(values.get("recent-links") ?? "[]")

    await runAdapterContract(() =>
      createLocalRecentLinksAdapter({
        storage: storage as Storage,
        storageKey: "recent-links",
        maximumItems: 100,
        read,
      })
    )
  })

  it("applies the common contract to server operations", async () => {
    let items: RecentLinkViewItem[] = []
    await runAdapterContract(() =>
      createServerRecentLinksAdapter({
        read: () => items,
        create: async (nextItem) => {
          items = [nextItem, ...items.filter(({ url }) => url !== nextItem.url)]
          return nextItem.id!
        },
        update: async (nextItem) => {
          items = items.map((currentItem) =>
            currentItem.url === nextItem.url ? nextItem : currentItem
          )
        },
        delete: async (id) => {
          items = items.filter((currentItem) => currentItem.id !== id)
        },
        clear: async () => {
          items = []
        },
      })
    )
  })
})

describe("Recent Links optimistic state", () => {
  it("rolls back a failed optimistic transition", async () => {
    const original = item("https://example.com/original", "original")
    const adapter: RecentLinksPersistenceAdapter = {
      list: async () => [original],
      add: async () => {
        throw new Error("offline")
      },
      update: async (nextItem) => nextItem,
      delete: async () => undefined,
      clear: async () => undefined,
    }
    const persistence = createRecentLinksPersistence(adapter, [original])
    const pendingAdd = persistence.add(item("https://example.com/new"))

    expect(persistence.getSnapshot()[0].url).toBe("https://example.com/new")
    await expect(pendingAdd).rejects.toThrow("offline")
    expect(persistence.getSnapshot()).toEqual([original])
  })

  it("ignores stale reconciliation versions", () => {
    const adapter = {
      list: vi.fn(async () => []),
      add: vi.fn(async (nextItem) => nextItem),
      update: vi.fn(async (nextItem) => nextItem),
      delete: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    } satisfies RecentLinksPersistenceAdapter
    const persistence = createRecentLinksPersistence(adapter)
    const current = item("https://example.com/current")

    persistence.reconcile([current], 2)
    persistence.reconcile([item("https://example.com/stale")], 1)

    expect(persistence.getSnapshot()).toEqual([current])
  })

  it("keeps a newer successful mutation when an older mutation fails", async () => {
    let rejectFirstAdd: (error: Error) => void = () => undefined
    const firstAdd = new Promise<RecentLinkViewItem>((_resolve, reject) => {
      rejectFirstAdd = reject
    })
    const adapter = {
      list: async () => [],
      add: vi
        .fn()
        .mockReturnValueOnce(firstAdd)
        .mockImplementationOnce(async (nextItem) => nextItem),
      update: async (nextItem: RecentLinkViewItem) => nextItem,
      delete: async () => undefined,
      clear: async () => undefined,
    } satisfies RecentLinksPersistenceAdapter
    const persistence = createRecentLinksPersistence(adapter)
    const olderMutation = persistence.add(item("https://example.com/older"))
    await persistence.add(item("https://example.com/newer"))

    rejectFirstAdd(new Error("offline"))
    await expect(olderMutation).rejects.toThrow("offline")
    expect(persistence.getSnapshot()[0].url).toBe("https://example.com/newer")
  })
})
