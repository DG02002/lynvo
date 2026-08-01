import type { LinkViewItem } from "~/features/links/types"

declare global {
  interface LinksPersistenceAdapter {
    list: () => Promise<LinkViewItem[]>
    add: (item: LinkViewItem) => Promise<LinkViewItem>
    update: (item: LinkViewItem) => Promise<LinkViewItem>
    delete: (item: LinkViewItem) => Promise<void>
    clear: () => Promise<void>
  }

  interface LinksPersistence {
    getSnapshot: () => LinkViewItem[]
    subscribe: (listener: () => void) => () => void
    load: () => Promise<void>
    reconcile: (items: LinkViewItem[], version?: number) => void
    add: (item: LinkViewItem) => Promise<LinkViewItem>
    update: (
      itemUrl: string,
      updateItem: (item: LinkViewItem) => LinkViewItem | undefined
    ) => Promise<void>
    delete: (itemUrl: string, itemId?: string) => Promise<void>
    clear: () => Promise<void>
    reset: (
      adapter: LinksPersistenceAdapter,
      identity: string,
      items: LinkViewItem[]
    ) => void
  }

  interface LinksOperation {
    id: number
    kind: "add" | "update" | "delete" | "clear"
    status: "pending" | "completed" | "failed"
    item?: LinkViewItem
    itemUrl?: string
    itemId?: string
    identityGeneration: number
  }

  interface LocalLinksAdapterOptions {
    storage: Storage
    storageKey: string
    maximumItems: number
    read: () => LinkViewItem[]
  }

  interface ServerLinksAdapterOptions {
    read: () => LinkViewItem[]
    create: (item: LinkViewItem) => Promise<string>
    update: (item: LinkViewItem) => Promise<void>
    delete: (id: string) => Promise<void>
    clear: () => Promise<void>
  }
}

const replaceByUrl = (items: LinkViewItem[], nextItem: LinkViewItem) => [
  nextItem,
  ...items.filter((item) => item.url !== nextItem.url),
]

export const createLocalLinksAdapter = ({
  storage,
  storageKey,
  maximumItems,
  read,
}: LocalLinksAdapterOptions): LinksPersistenceAdapter => {
  const write = (items: LinkViewItem[]) =>
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

export const createServerLinksAdapter = ({
  read,
  create,
  update,
  delete: deleteItem,
  clear,
}: ServerLinksAdapterOptions): LinksPersistenceAdapter => ({
  list: async () => read(),
  add: async (item) => ({ ...item, id: await create(item) }),
  update: async (item) => {
    await update(item)
    return item
  },
  delete: async (item) => {
    if (!item.id) {
      throw new Error("Link ID is required")
    }
    await deleteItem(item.id)
  },
  clear,
})

export const createLinksPersistence = (
  initialAdapter: LinksPersistenceAdapter,
  initialItems: LinkViewItem[] = [],
  initialIdentity = "default"
): LinksPersistence => {
  let adapter = initialAdapter
  let identity = initialIdentity
  let baseItems = initialItems
  let visibleItems = initialItems
  let nextOperationId = 1
  let identityGeneration = 0
  const operations: LinksOperation[] = []
  const operationSettlements = new WeakMap<LinksOperation, Promise<void>>()
  const resolveOperationSettlements = new WeakMap<LinksOperation, () => void>()
  let reconciliationVersion = 0
  const listeners = new Set<() => void>()

  const applyOperation = (
    items: LinkViewItem[],
    operation: LinksOperation
  ): LinkViewItem[] => {
    if (operation.kind === "clear") {
      return []
    }
    if (operation.kind === "add" && operation.item) {
      return replaceByUrl(items, operation.item)
    }
    if (operation.kind === "update" && operation.item) {
      const updatedItem = operation.item
      return items.map((currentItem) =>
        currentItem.url === operation.itemUrl ? updatedItem : currentItem
      )
    }
    if (operation.kind === "delete") {
      return items.filter(
        (currentItem) =>
          currentItem.url !== operation.itemUrl ||
          (operation.itemId !== undefined &&
            currentItem.id !== operation.itemId)
      )
    }
    return items
  }

  const deriveVisibleItems = () => operations.reduce(applyOperation, baseItems)

  const publish = () => {
    visibleItems = deriveVisibleItems()
    listeners.forEach((listener) => listener())
  }

  const compactCompletedOperations = () => {
    while (operations[0]?.status === "completed") {
      const operation = operations.shift()
      if (operation) {
        baseItems = applyOperation(baseItems, operation)
      }
    }
  }

  const runOperation = async <Result>(
    operation: LinksOperation,
    persist: () => Promise<Result>,
    complete: (result: Result) => void
  ) => {
    operations.push(operation)
    publish()
    try {
      const result = await persist()
      if (operation.identityGeneration !== identityGeneration) {
        resolveOperationSettlements.get(operation)?.()
        return result
      }
      complete(result)
      operation.status = "completed"
      compactCompletedOperations()
      publish()
      resolveOperationSettlements.get(operation)?.()
      return result
    } catch (error) {
      operation.status = "failed"
      if (operation.identityGeneration !== identityGeneration) {
        resolveOperationSettlements.get(operation)?.()
        throw error
      }
      const operationIndex = operations.findIndex(
        (currentOperation) => currentOperation.id === operation.id
      )
      if (operationIndex !== -1) {
        operations.splice(operationIndex, 1)
      }
      compactCompletedOperations()
      publish()
      resolveOperationSettlements.get(operation)?.()
      throw error
    }
  }

  const createOperation = (
    operation: Omit<LinksOperation, "id" | "status" | "identityGeneration">
  ): LinksOperation => {
    const nextOperation: LinksOperation = {
      ...operation,
      id: nextOperationId++,
      status: "pending",
      identityGeneration,
    }
    operationSettlements.set(
      nextOperation,
      new Promise((resolve) => {
        resolveOperationSettlements.set(nextOperation, resolve)
      })
    )
    return nextOperation
  }

  const findPriorPendingAdd = (itemUrl: string) => {
    for (let index = operations.length - 1; index >= 0; index -= 1) {
      const operation = operations[index]
      if (operation?.kind === "add" && operation.item?.url === itemUrl) {
        return operation
      }
    }
    return undefined
  }

  const waitForPriorAdd = async (operation?: LinksOperation) => {
    if (operation) {
      await operationSettlements.get(operation)
    }
    return operation
  }

  return {
    getSnapshot: () => visibleItems,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    load: async () => {
      const loadVersion = reconciliationVersion
      const loadIdentityGeneration = identityGeneration
      const loadedItems = await adapter.list()
      if (
        loadVersion === reconciliationVersion &&
        loadIdentityGeneration === identityGeneration
      ) {
        baseItems = loadedItems
        publish()
      }
    },
    reconcile: (nextItems, version = reconciliationVersion + 1) => {
      if (version < reconciliationVersion) {
        return
      }
      reconciliationVersion = version
      baseItems = nextItems
      publish()
    },
    add: async (item) => {
      const mutationAdapter = adapter
      const operation = createOperation({ kind: "add", item })
      return await runOperation(
        operation,
        () => mutationAdapter.add(item),
        (persistedItem) => {
          operation.item = persistedItem
        }
      )
    },
    update: async (itemUrl, updateItem) => {
      const currentItem = visibleItems.find((item) => item.url === itemUrl)
      if (!currentItem) {
        return
      }
      const updatedItem = updateItem(currentItem)
      if (!updatedItem) {
        return
      }
      const operation = createOperation({
        kind: "update",
        itemUrl,
        item: updatedItem,
      })
      const mutationAdapter = adapter
      const priorAdd = findPriorPendingAdd(itemUrl)
      await runOperation(
        operation,
        async () => {
          const settledAdd = await waitForPriorAdd(priorAdd)
          const itemWithPersistedId =
            settledAdd?.status === "completed" && settledAdd.item?.id
              ? { ...updatedItem, id: settledAdd.item.id }
              : updatedItem
          return settledAdd?.status === "failed"
            ? itemWithPersistedId
            : await mutationAdapter.update(itemWithPersistedId)
        },
        (persistedItem) => {
          operation.item = persistedItem
        }
      )
    },
    delete: async (itemUrl, itemId) => {
      const item = visibleItems.find(
        (currentItem) =>
          currentItem.url === itemUrl && (!itemId || currentItem.id === itemId)
      )
      if (!item) {
        return
      }
      const priorAdd = findPriorPendingAdd(itemUrl)
      const mutationAdapter = adapter
      const operation = createOperation({ kind: "delete", itemUrl, itemId })
      await runOperation(
        operation,
        async () => {
          const settledAdd = await waitForPriorAdd(priorAdd)
          if (settledAdd?.status === "failed") {
            return
          }
          const itemToDelete =
            settledAdd?.status === "completed" && settledAdd.item?.id
              ? { ...item, id: settledAdd.item.id }
              : item
          await mutationAdapter.delete(itemToDelete)
        },
        () => undefined
      )
    },
    clear: async () => {
      const mutationAdapter = adapter
      const operation = createOperation({ kind: "clear" })
      await runOperation(
        operation,
        () => mutationAdapter.clear(),
        () => undefined
      )
    },
    reset: (nextAdapter, nextIdentity, nextItems) => {
      if (nextIdentity === identity) {
        adapter = nextAdapter
        return
      }
      adapter = nextAdapter
      identity = nextIdentity
      baseItems = nextItems
      operations.splice(0)
      reconciliationVersion = 0
      identityGeneration += 1
      publish()
    },
  }
}
