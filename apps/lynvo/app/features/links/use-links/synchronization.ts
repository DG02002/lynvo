import type { SavedLink } from "~/features/links/links.mapper"
import type { LinkViewItem } from "~/features/links/types"
import { linksToLinkViewItems, writeLinksCache, type LinksCache } from "./cache"
import { createLinksPersistence } from "./persistence"

declare global {
  interface SavedLinkSynchronizationInput {
    adapter: LinksPersistenceAdapter
    identity: string
    cachedItems: LinkViewItem[]
    remote?: LinksCache
  }

  interface SavedLinkSynchronizationCache {
    publish: (identity: string, cache: LinksCache) => void
  }

  interface SavedLinkSynchronization extends LinksMutationPersistence {
    getSnapshot: LinksPersistence["getSnapshot"]
    subscribe: LinksPersistence["subscribe"]
    synchronize: (input: SavedLinkSynchronizationInput) => Promise<void>
  }
}

export const createSavedLinkSynchronization = (
  adapter: LinksPersistenceAdapter,
  identity: string,
  cachedItems: LinkViewItem[],
  cache: SavedLinkSynchronizationCache = { publish: writeLinksCache }
): SavedLinkSynchronization => {
  const persistence = createLinksPersistence(adapter, cachedItems, identity)
  let currentIdentity = identity
  let loadPromise: Promise<void> | undefined

  const acceptRemote = (items: SavedLink[], version?: number) => {
    persistence.reconcile(
      linksToLinkViewItems(items, persistence.getSnapshot()),
      version
    )
  }

  return {
    getSnapshot: persistence.getSnapshot,
    subscribe: persistence.subscribe,
    add: persistence.add,
    update: persistence.update,
    delete: persistence.delete,
    clear: persistence.clear,
    synchronize: async (input) => {
      if (input.identity !== currentIdentity) {
        currentIdentity = input.identity
        loadPromise = undefined
      }
      persistence.reset(input.adapter, input.identity, input.cachedItems)
      loadPromise ??= persistence.load()
      if (input.remote) {
        if (input.identity !== "signed-out") {
          cache.publish(input.identity, input.remote)
        }
        acceptRemote(input.remote.results, input.remote.version)
      }
      await loadPromise
    },
  }
}
