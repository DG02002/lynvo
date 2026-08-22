import type { ExtractedLink, LinkViewItem } from "~/features/links/types"

declare global {
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

  interface LinksSnapshotStore {
    getSnapshot: () => LinkViewItem[]
    getVersion: () => number
    subscribe: (listener: () => void) => () => void
    applyServerSnapshot: (items: LinkViewItem[], version: number) => boolean
    beginAdd: (item: LinkViewItem) => LinkViewItem & { readonly id: string }
    settleAdd: (temporaryId: string, serverId: string, version: number) => void
    discardPendingAdd: (temporaryId: string) => void
    findVisibleItemByUrl: (
      itemUrl: string,
      itemId?: string
    ) => LinkViewItem | undefined
    beginUpdate: (
      linkId: string,
      updateItem: (item: LinkViewItem) => LinkViewItem | undefined
    ) => LinkViewItem | undefined
    beginRemove: (linkId: string) => boolean
    beginClear: () => void
    resetOverlayToServerSnapshot: () => void
  }
}

interface PendingEntry {
  kind: "add" | "update" | "remove"
  settledAtVersion: number
  item?: LinkViewItem
}

const TEMPORARY_ID_PREFIX = "temp:"

export const createTemporaryLinkId = (): string =>
  `${TEMPORARY_ID_PREFIX}${crypto.randomUUID()}`

export const isTemporaryLinkId = (linkId: string | undefined): boolean =>
  Boolean(linkId?.startsWith(TEMPORARY_ID_PREFIX))

export const createLinksSnapshotStore = (): LinksSnapshotStore => {
  let version = 0
  let settledItems: LinkViewItem[] = []
  let clearedFromVersion: number | null = null
  const pendingEntries = new Map<string, PendingEntry>()
  const pendingAddOrder: string[] = []
  const listeners = new Set<() => void>()

  const publish = () => {
    listeners.forEach((listener) => listener())
  }

  const deriveBaseItems = (): LinkViewItem[] => {
    if (clearedFromVersion !== null) {
      return []
    }
    return settledItems.flatMap((item) => {
      if (!item.id) {
        return []
      }
      const entry = pendingEntries.get(item.id)
      if (entry?.kind === "remove") {
        return []
      }
      if (entry?.kind === "update" && entry.item) {
        return [{ ...entry.item, id: item.id }]
      }
      return [item]
    })
  }

  const deriveVisibleItems = (): LinkViewItem[] => {
    const baseItems = deriveBaseItems()
    const baseUrls = new Set(baseItems.map((item) => item.url))
    const temporaryItems = pendingAddOrder.flatMap((temporaryId) => {
      const entry = pendingEntries.get(temporaryId)
      if (entry?.kind !== "add" || !entry.item) {
        return []
      }
      if (baseUrls.has(entry.item.url)) {
        return []
      }
      return [entry.item]
    })
    return [...temporaryItems, ...baseItems]
  }

  let visibleItems = deriveVisibleItems()

  const republish = () => {
    visibleItems = deriveVisibleItems()
    publish()
  }

  const forgetEntry = (entryId: string, entry: PendingEntry) => {
    pendingEntries.delete(entryId)
    if (entry.kind === "add") {
      const orderIndex = pendingAddOrder.indexOf(entryId)
      if (orderIndex !== -1) {
        pendingAddOrder.splice(orderIndex, 1)
      }
    }
  }

  const dropSettledEntries = () => {
    for (const [entryId, entry] of pendingEntries) {
      if (version >= entry.settledAtVersion) {
        forgetEntry(entryId, entry)
      }
    }
    if (clearedFromVersion !== null && version >= clearedFromVersion + 1) {
      clearedFromVersion = null
    }
  }

  return {
    getSnapshot: () => visibleItems,
    getVersion: () => version,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    applyServerSnapshot: (items, snapshotVersion) => {
      if (snapshotVersion < version) {
        return false
      }
      version = snapshotVersion
      settledItems = items.filter((item) => Boolean(item.id))
      dropSettledEntries()
      republish()
      return true
    },
    beginAdd: (item) => {
      const temporaryId = createTemporaryLinkId()
      const temporaryItem = { ...item, id: temporaryId }
      pendingEntries.set(temporaryId, {
        kind: "add",
        settledAtVersion: version + 1,
        item: temporaryItem,
      })
      pendingAddOrder.push(temporaryId)
      republish()
      return temporaryItem
    },
    settleAdd: (temporaryId, serverId, responseVersion) => {
      const entry = pendingEntries.get(temporaryId)
      if (entry?.kind !== "add" || !entry.item) {
        return
      }
      pendingEntries.delete(temporaryId)
      const orderIndex = pendingAddOrder.indexOf(temporaryId)
      if (orderIndex !== -1) {
        pendingAddOrder.splice(orderIndex, 1)
      }
      const settledItem = { ...entry.item, id: serverId }
      if (!settledItems.some((item) => item.id === serverId)) {
        settledItems = [settledItem, ...settledItems]
      }
      pendingEntries.set(serverId, {
        kind: "update",
        settledAtVersion: Math.max(responseVersion, version),
        item: settledItem,
      })
      republish()
    },
    discardPendingAdd: (temporaryId) => {
      const entry = pendingEntries.get(temporaryId)
      if (entry) {
        forgetEntry(temporaryId, entry)
        republish()
      }
    },
    findVisibleItemByUrl: (itemUrl, itemId) => {
      const candidates = visibleItems.filter((item) => item.url === itemUrl)
      const matchedCandidate = candidates.find((candidate) =>
        itemId ? candidate.id === itemId : Boolean(candidate.id)
      )
      return matchedCandidate ?? candidates[0]
    },
    beginUpdate: (linkId, updateItem) => {
      const currentItem = visibleItems.find((item) => item.id === linkId)
      if (!currentItem) {
        return undefined
      }
      const updatedItem = updateItem(currentItem)
      if (!updatedItem) {
        return undefined
      }
      pendingEntries.set(linkId, {
        kind: "update",
        settledAtVersion: version + 1,
        item: updatedItem,
      })
      republish()
      return updatedItem
    },
    beginRemove: (linkId) => {
      if (!visibleItems.some((item) => item.id === linkId)) {
        return false
      }
      pendingEntries.set(linkId, {
        kind: "remove",
        settledAtVersion: version + 1,
      })
      republish()
      return true
    },
    beginClear: () => {
      pendingEntries.clear()
      pendingAddOrder.splice(0)
      clearedFromVersion = version
      republish()
    },
    resetOverlayToServerSnapshot: () => {
      if (pendingEntries.size === 0 && clearedFromVersion === null) {
        return
      }
      pendingEntries.clear()
      pendingAddOrder.splice(0)
      clearedFromVersion = null
      republish()
    },
  }
}
