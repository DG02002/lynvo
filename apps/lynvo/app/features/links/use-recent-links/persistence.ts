import type { RecentLinkViewItem } from "~/features/links/types"

declare global {
  interface RecentLinksPersistenceAdapter {
    list: () => Promise<RecentLinkViewItem[]>
    add: (item: RecentLinkViewItem) => Promise<RecentLinkViewItem>
    update: (item: RecentLinkViewItem) => Promise<RecentLinkViewItem>
    delete: (item: RecentLinkViewItem) => Promise<void>
    clear: () => Promise<void>
  }

  interface RecentLinksPersistence {
    getSnapshot: () => RecentLinkViewItem[]
    subscribe: (listener: () => void) => () => void
    load: () => Promise<void>
    reconcile: (items: RecentLinkViewItem[], version?: number) => void
    add: (item: RecentLinkViewItem) => Promise<RecentLinkViewItem>
    update: (
      itemUrl: string,
      updateItem: (item: RecentLinkViewItem) => RecentLinkViewItem | undefined
    ) => Promise<void>
    delete: (itemUrl: string, itemId?: string) => Promise<void>
    clear: () => Promise<void>
  }

  interface LocalRecentLinksAdapterOptions {
    storage: Storage
    storageKey: string
    maximumItems: number
    read: () => RecentLinkViewItem[]
  }

  interface ServerRecentLinksAdapterOptions {
    read: () => RecentLinkViewItem[]
    create: (item: RecentLinkViewItem) => Promise<string>
    update: (item: RecentLinkViewItem) => Promise<void>
    delete: (id: string) => Promise<void>
    clear: () => Promise<void>
  }
}

const replaceByUrl = (
  items: RecentLinkViewItem[],
  nextItem: RecentLinkViewItem
) => [nextItem, ...items.filter((item) => item.url !== nextItem.url)]

export const createLocalRecentLinksAdapter = ({
  storage,
  storageKey,
  maximumItems,
  read,
}: LocalRecentLinksAdapterOptions): RecentLinksPersistenceAdapter => {
  const write = (items: RecentLinkViewItem[]) =>
    storage.setItem(storageKey, JSON.stringify(items.slice(0, maximumItems)))

  return {
    list: async () => read(),
    add: async (item) => {
      write(replaceByUrl(read(), item))
      return item
    },
    update: async (item) => {
      write(
        read().map((currentItem) =>
          currentItem.url === item.url ? item : currentItem
        )
      )
      return item
    },
    delete: async (item) => {
      write(read().filter((currentItem) => currentItem.url !== item.url))
    },
    clear: async () => {
      storage.removeItem(storageKey)
    },
  }
}

export const createServerRecentLinksAdapter = ({
  read,
  create,
  update,
  delete: deleteItem,
  clear,
}: ServerRecentLinksAdapterOptions): RecentLinksPersistenceAdapter => ({
  list: async () => read(),
  add: async (item) => ({ ...item, id: await create(item) }),
  update: async (item) => {
    await update(item)
    return item
  },
  delete: async (item) => {
    if (!item.id) {
      throw new Error("Recent Link ID is required")
    }
    await deleteItem(item.id)
  },
  clear,
})

export const createRecentLinksPersistence = (
  adapter: RecentLinksPersistenceAdapter,
  initialItems: RecentLinkViewItem[] = []
): RecentLinksPersistence => {
  let items = initialItems
  let reconciliationVersion = 0
  let mutationVersion = 0
  const listeners = new Set<() => void>()

  const publish = (nextItems: RecentLinkViewItem[]) => {
    items = nextItems
    listeners.forEach((listener) => listener())
  }

  const runOptimisticMutation = async (
    optimisticItems: RecentLinkViewItem[],
    persist: () => Promise<RecentLinkViewItem[]>
  ) => {
    const previousItems = items
    const currentMutationVersion = ++mutationVersion
    publish(optimisticItems)
    try {
      publish(await persist())
    } catch (error) {
      if (currentMutationVersion === mutationVersion) {
        publish(previousItems)
      }
      throw error
    }
  }

  return {
    getSnapshot: () => items,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    load: async () => {
      const loadVersion = reconciliationVersion
      const loadedItems = await adapter.list()
      if (loadVersion === reconciliationVersion) {
        publish(loadedItems)
      }
    },
    reconcile: (nextItems, version = reconciliationVersion + 1) => {
      if (version < reconciliationVersion) {
        return
      }
      reconciliationVersion = version
      publish(nextItems)
    },
    add: async (item) => {
      let persistedItem = item
      await runOptimisticMutation(replaceByUrl(items, item), async () => {
        persistedItem = await adapter.add(item)
        return replaceByUrl(items, persistedItem)
      })
      return persistedItem
    },
    update: async (itemUrl, updateItem) => {
      const itemIndex = items.findIndex((item) => item.url === itemUrl)
      if (itemIndex === -1) {
        return
      }
      const updatedItem = updateItem(items[itemIndex])
      if (!updatedItem) {
        return
      }
      const optimisticItems = items.with(itemIndex, updatedItem)
      await runOptimisticMutation(optimisticItems, async () => {
        const persistedItem = await adapter.update(updatedItem)
        return optimisticItems.with(itemIndex, persistedItem)
      })
    },
    delete: async (itemUrl, itemId) => {
      const item = items.find(
        (currentItem) =>
          currentItem.url === itemUrl && (!itemId || currentItem.id === itemId)
      )
      if (!item) {
        return
      }
      const optimisticItems = items.filter(
        (currentItem) => currentItem !== item
      )
      await runOptimisticMutation(optimisticItems, async () => {
        await adapter.delete(item)
        return optimisticItems
      })
    },
    clear: async () => {
      await runOptimisticMutation([], async () => {
        await adapter.clear()
        return []
      })
    },
  }
}
