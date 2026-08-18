import type { ExtractedLink, LinkViewItem } from "~/features/links/types"

declare global {
  interface LinksPersistenceAdapter {
    list: () => Promise<LinkViewItem[]>
    add: (item: LinkViewItem) => Promise<LinkViewItem>
    update: (
      item: LinkViewItem,
      metadataOperation?: LinkMetadataOperation
    ) => Promise<LinkViewItem>
    delete: (item: LinkViewItem) => Promise<void>
    clear: () => Promise<void>
  }

  interface LinksPersistence {
    getSnapshot: () => LinkViewItem[]
    subscribe: (listener: () => void) => () => void
    load: () => Promise<void>
    reconcile: (items: LinkViewItem[]) => void
    add: (item: LinkViewItem) => Promise<LinkViewItem>
    update: (
      itemUrl: string,
      updateItem: (item: LinkViewItem) => LinkViewItem | undefined,
      metadataOperation?: LinkMetadataOperation
    ) => Promise<void>
    delete: (itemUrl: string, itemId?: string) => Promise<void>
    clear: () => Promise<void>
    reset: (
      adapter: LinksPersistenceAdapter,
      identity: string,
      items: LinkViewItem[]
    ) => void
  }

  interface LinksMutationPersistence extends Pick<
    LinksPersistence,
    "add" | "update" | "delete" | "clear"
  > {}

  interface LinksOperation {
    id: number
    kind: "add" | "update" | "delete" | "clear"
    status: "pending" | "completed" | "failed"
    item?: LinkViewItem
    itemUrl?: string
    itemId?: string
    identityGeneration: number
    metadataOperation?: LinkMetadataOperation
    replayUpdate?: (item: LinkViewItem) => LinkViewItem | undefined
  }

  interface LinkMetadataOperation {
    kind:
      | "markOpened"
      | "cacheMirrors"
      | "removeExtractedLink"
      | "replaceExtraction"
    linkUrl?: string
    linkKey?: string
    lazyItemUrl?: string
    mirrors?: ExtractedLink[]
    expectedExtraction?: ExtractedLink[]
    extractedLinks?: ExtractedLink[]
  }

  interface ServerLinksAdapterOptions {
    read: () => LinkViewItem[]
    create: (item: LinkViewItem) => Promise<string>
    update: (
      item: LinkViewItem,
      metadataOperation?: LinkMetadataOperation
    ) => Promise<void>
    delete: (id: string) => Promise<void>
    clear: () => Promise<void>
  }
}

const replaceByUrl = (items: LinkViewItem[], nextItem: LinkViewItem) => [
  nextItem,
  ...items.filter((item) => item.url !== nextItem.url),
]

export const createServerLinksAdapter = ({
  read,
  create,
  update,
  delete: deleteItem,
  clear,
}: ServerLinksAdapterOptions): LinksPersistenceAdapter => ({
  list: async () => read(),
  add: async (item) => ({ ...item, id: await create(item) }),
  update: async (item, metadataOperation) => {
    await update(item, metadataOperation)
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
  let snapshotGeneration = 0
  const operations: LinksOperation[] = []
  const operationSettlements = new WeakMap<LinksOperation, Promise<void>>()
  const resolveOperationSettlements = new WeakMap<LinksOperation, () => void>()
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
        currentItem.url === operation.itemUrl
          ? (operation.replayUpdate?.(currentItem) ?? updatedItem)
          : currentItem
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
      const loadSnapshotGeneration = snapshotGeneration
      const loadIdentityGeneration = identityGeneration
      const loadedItems = await adapter.list()
      if (
        loadSnapshotGeneration === snapshotGeneration &&
        loadIdentityGeneration === identityGeneration
      ) {
        baseItems = loadedItems
        publish()
      }
    },
    reconcile: (nextItems) => {
      snapshotGeneration += 1
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
    update: async (itemUrl, updateItem, metadataOperation) => {
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
        metadataOperation:
          metadataOperation?.kind === "replaceExtraction"
            ? {
                ...metadataOperation,
                expectedExtraction:
                  currentItem.metadata.extraction.extractedLinks,
              }
            : metadataOperation,
        replayUpdate: metadataOperation ? updateItem : undefined,
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
            : await mutationAdapter.update(
                itemWithPersistedId,
                operation.metadataOperation
              )
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
      snapshotGeneration += 1
      identityGeneration += 1
      publish()
    },
  }
}
