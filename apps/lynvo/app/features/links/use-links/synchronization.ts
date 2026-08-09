import type { SavedLink } from "~/features/links/links.mapper"
import type { LinkViewItem } from "~/features/links/types"
import { linksToLinkViewItems } from "./cache"
import { createLinksPersistence } from "./persistence"

declare global {
  interface SavedLinkSynchronization extends LinksPersistence {
    connect: (
      adapter: LinksPersistenceAdapter,
      identity: string,
      cachedItems: LinkViewItem[]
    ) => void
    acceptRemote: (items: SavedLink[], version?: number) => void
  }
}

export const createSavedLinkSynchronization = (
  adapter: LinksPersistenceAdapter,
  identity: string,
  cachedItems: LinkViewItem[]
): SavedLinkSynchronization => {
  const persistence = createLinksPersistence(adapter, cachedItems, identity)

  return {
    ...persistence,
    connect: (nextAdapter, nextIdentity, nextCachedItems) => {
      persistence.reset(nextAdapter, nextIdentity, nextCachedItems)
    },
    acceptRemote: (items, version) => {
      persistence.reconcile(
        linksToLinkViewItems(items, persistence.getSnapshot()),
        version
      )
    },
  }
}
