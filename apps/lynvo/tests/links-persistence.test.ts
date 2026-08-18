import { describe, expect, it, vi } from "vitest"
import type { LinkViewItem } from "~/features/links/types"
import {
  createServerLinksAdapter,
  createLinksPersistence,
} from "~/features/links/use-links/persistence"

const item = (url: string, id?: string): LinkViewItem => ({
  id,
  url,
  title: url,
  timestamp: 1,
})

const deferred = <Value>() => {
  let resolve: (value: Value) => void = () => undefined
  let reject: (error: Error) => void = () => undefined
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const createAdapter = (
  overrides: Partial<LinksPersistenceAdapter> = {}
): LinksPersistenceAdapter => ({
  list: async () => [],
  add: async (nextItem) => nextItem,
  update: async (nextItem) => nextItem,
  delete: async () => undefined,
  clear: async () => undefined,
  ...overrides,
})

const runAdapterContract = async (
  createAdapter: () => LinksPersistenceAdapter
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

describe("Links persistence adapters", () => {
  it("applies the common contract to server operations", async () => {
    let items: LinkViewItem[] = []
    await runAdapterContract(() =>
      createServerLinksAdapter({
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

describe("Links optimistic state", () => {
  it("rolls back a failed optimistic transition", async () => {
    const original = item("https://example.com/original", "original")
    const adapter: LinksPersistenceAdapter = {
      list: async () => [original],
      add: async () => {
        throw new Error("offline")
      },
      update: async (nextItem) => nextItem,
      delete: async () => undefined,
      clear: async () => undefined,
    }
    const persistence = createLinksPersistence(adapter, [original])
    const pendingAdd = persistence.add(item("https://example.com/new"))

    expect(persistence.getSnapshot()[0].url).toBe("https://example.com/new")
    await expect(pendingAdd).rejects.toThrow("offline")
    expect(persistence.getSnapshot()).toEqual([original])
  })

  it("keeps a newer successful mutation when an older mutation fails", async () => {
    let rejectFirstAdd: (error: Error) => void = () => undefined
    const firstAdd = new Promise<LinkViewItem>((_resolve, reject) => {
      rejectFirstAdd = reject
    })
    const adapter = {
      list: async () => [],
      add: vi
        .fn()
        .mockReturnValueOnce(firstAdd)
        .mockImplementationOnce(async (nextItem) => nextItem),
      update: async (nextItem: LinkViewItem) => nextItem,
      delete: async () => undefined,
      clear: async () => undefined,
    } satisfies LinksPersistenceAdapter
    const persistence = createLinksPersistence(adapter)
    const olderMutation = persistence.add(item("https://example.com/older"))
    await persistence.add(item("https://example.com/newer"))

    rejectFirstAdd(new Error("offline"))
    await expect(olderMutation).rejects.toThrow("offline")
    expect(persistence.getSnapshot()).toEqual([
      item("https://example.com/newer"),
    ])
  })

  it("keeps an older success when a newer independent mutation fails", async () => {
    const olderResult = deferred<LinkViewItem>()
    const adapter = createAdapter({
      add: vi
        .fn()
        .mockReturnValueOnce(olderResult.promise)
        .mockRejectedValueOnce(new Error("offline")),
    })
    const persistence = createLinksPersistence(adapter)
    const olderItem = item("https://example.com/older")
    const olderMutation = persistence.add(olderItem)
    const newerMutation = persistence.add(item("https://example.com/newer"))

    await expect(newerMutation).rejects.toThrow("offline")
    olderResult.resolve(olderItem)
    await olderMutation

    expect(persistence.getSnapshot()).toEqual([olderItem])
  })

  it("rebases remote snapshots over pending optimistic operations", async () => {
    const addResult = deferred<LinkViewItem>()
    const optimistic = item("https://example.com/optimistic")
    const remote = item("https://example.com/remote", "remote")
    const persistence = createLinksPersistence(
      createAdapter({ add: async () => await addResult.promise })
    )
    const pendingAdd = persistence.add(optimistic)

    persistence.reconcile([remote])

    expect(persistence.getSnapshot()).toEqual([optimistic, remote])
    addResult.resolve({ ...optimistic, id: "persisted" })
    await pendingAdd
    expect(persistence.getSnapshot()).toEqual([
      { ...optimistic, id: "persisted" },
      remote,
    ])
  })

  it("replays a completed semantic update over a newer reconciliation", async () => {
    const updateResult = deferred<LinkViewItem>()
    const original = item("https://example.com/semantic", "semantic")
    const persistence = createLinksPersistence(
      createAdapter({ update: async () => await updateResult.promise }),
      [original]
    )
    const pendingUpdate = persistence.update(
      original.url,
      (currentItem) => ({ ...currentItem, timestamp: 2 }),
      { kind: "markOpened", linkUrl: original.url }
    )
    const reconciled = { ...original, title: "Authoritative", timestamp: 1 }
    persistence.reconcile([reconciled])
    updateResult.resolve({ ...original, timestamp: 2 })
    await pendingUpdate

    expect(persistence.getSnapshot()).toEqual([
      { ...reconciled, timestamp: 2 },
    ])
  })

  it("resolves same-item updates and deletion in operation order", async () => {
    const original = item("https://example.com/same", "same")
    const firstUpdate = deferred<LinkViewItem>()
    const persistence = createLinksPersistence(
      createAdapter({
        update: vi
          .fn()
          .mockReturnValueOnce(firstUpdate.promise)
          .mockImplementationOnce(async (nextItem) => nextItem),
      }),
      [original]
    )
    const olderUpdate = persistence.update(original.url, (currentItem) => ({
      ...currentItem,
      title: "Older update",
    }))
    await persistence.update(original.url, (currentItem) => ({
      ...currentItem,
      title: "Newer update",
    }))

    firstUpdate.resolve({ ...original, title: "Older update" })
    await olderUpdate
    expect(persistence.getSnapshot()[0]?.title).toBe("Newer update")

    await persistence.delete(original.url, original.id)
    expect(persistence.getSnapshot()).toEqual([])
  })

  it("keeps operations after clear while removing operations before it", async () => {
    const clearResult = deferred<void>()
    const laterItem = item("https://example.com/after-clear")
    const persistence = createLinksPersistence(
      createAdapter({ clear: async () => await clearResult.promise }),
      [item("https://example.com/original")]
    )
    const pendingClear = persistence.clear()
    await persistence.add(laterItem)

    expect(persistence.getSnapshot()).toEqual([laterItem])
    clearResult.resolve()
    await pendingClear
    expect(persistence.getSnapshot()).toEqual([laterItem])
  })

  it("orders deletion after an in-flight add of the same URL", async () => {
    const addResult = deferred<LinkViewItem>()
    const deleteItem = vi.fn(async () => undefined)
    const optimistic = item("https://example.com/add-delete")
    const persistence = createLinksPersistence(
      createAdapter({
        add: async () => await addResult.promise,
        delete: deleteItem,
      })
    )
    const pendingAdd = persistence.add(optimistic)
    const pendingDelete = persistence.delete(optimistic.url)

    addResult.resolve({ ...optimistic, id: "persisted-id" })
    await pendingAdd
    await pendingDelete

    expect(deleteItem).toHaveBeenCalledWith({
      ...optimistic,
      id: "persisted-id",
    })
    expect(persistence.getSnapshot()).toEqual([])
  })

  it("prevents stale loads from crossing reconciliation or identity boundaries", async () => {
    const loadResult = deferred<LinkViewItem[]>()
    const persistence = createLinksPersistence(
      createAdapter({ list: async () => await loadResult.promise }),
      [],
      "user-old"
    )
    const pendingLoad = persistence.load()
    const live = item("https://example.com/live")
    persistence.reconcile([live])
    loadResult.resolve([item("https://example.com/stale")])
    await pendingLoad
    expect(persistence.getSnapshot()).toEqual([live])

    const oldIdentityLoad = deferred<LinkViewItem[]>()
    persistence.reset(
      createAdapter({ list: async () => await oldIdentityLoad.promise }),
      "user-1",
      [item("https://example.com/user-one")]
    )
    const pendingIdentityLoad = persistence.load()
    const userTwo = item("https://example.com/user-two")
    persistence.reset(createAdapter(), "user-2", [userTwo])
    oldIdentityLoad.resolve([item("https://example.com/wrong-user")])
    await pendingIdentityLoad
    expect(persistence.getSnapshot()).toEqual([userTwo])

    const oldMutation = deferred<LinkViewItem>()
    persistence.reset(
      createAdapter({ add: async () => await oldMutation.promise }),
      "user-3",
      []
    )
    const pendingOldMutation = persistence.add(
      item("https://example.com/user-three")
    )
    persistence.reset(createAdapter(), "user-4", [userTwo])
    oldMutation.resolve(item("https://example.com/user-three", "persisted"))
    await pendingOldMutation
    expect(persistence.getSnapshot()).toEqual([userTwo])
  })
})
