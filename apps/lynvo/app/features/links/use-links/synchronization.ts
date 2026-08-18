import type { SavedLink } from "~/features/links/links.mapper"
import type { LinkViewItem } from "~/features/links/types"
import { linksToLinkViewItems, type SavedLinksSnapshot } from "./cache"
import { createLinksPersistence } from "./persistence"

declare global {
  interface SavedLinkSynchronizationInput {
    adapter: LinksPersistenceAdapter
    identity: string
    cachedItems: LinkViewItem[]
    remote?: SavedLinksSnapshot
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
  cachedItems: LinkViewItem[]
): SavedLinkSynchronization => {
  const persistence = createLinksPersistence(adapter, cachedItems, identity)
  let currentIdentity = identity
  let loadPromise: Promise<void> | undefined

  const acceptRemote = (items: SavedLink[]) => {
    persistence.reconcile(
      linksToLinkViewItems(items, persistence.getSnapshot())
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
        acceptRemote(input.remote.results)
      }
      await loadPromise
    },
  }
}
