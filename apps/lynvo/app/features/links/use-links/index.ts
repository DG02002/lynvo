import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import { useMutation as useConvexMutation } from "convex/react"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import { api } from "../../../../convex/_generated/api"
import { useLinksQuery } from "./query"
import { useLinksMutations } from "./mutations"
import { useLinksPaginationAndSort } from "./pagination"
import type { LinksActions } from "./actions"
import { createServerLinksAdapter } from "./persistence"
import { createSavedLinkSynchronization } from "./synchronization"
import { createServerLink } from "./link-server"
import type {
  LinkMetadata,
  LinkViewItem,
  SavedLinkListItem,
} from "~/features/links/types"
import { linkMetadataSchema } from "~/features/links/storage-schemas"

const EMPTY_LINKS: LinkViewItem[] = []
const subscribeToHydration = () => () => undefined
const getHydratedSnapshot = () => true
const getServerHydratedSnapshot = () => false

const toJsonMetadata = (metadata: LinkMetadata): LinkMetadata =>
  linkMetadataSchema.parse(JSON.parse(JSON.stringify(metadata)))

const toSavedLinkListItem = (item: LinkViewItem): SavedLinkListItem => ({
  ...item,
  kind: "saved",
})

const CONVEX_MUTATION_TIMEOUT_MS = 15_000

const withMutationTimeout = <Result>(
  operation: Promise<Result>,
  timeoutMessage = "Convex mutation timed out"
): Promise<Result> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(timeoutMessage)),
      CONVEX_MUTATION_TIMEOUT_MS
    )
  })
  return Promise.race([
    operation.finally(() => {
      if (timer !== undefined) {
        clearTimeout(timer)
      }
    }),
    timeoutPromise,
  ])
}

export const useLinks = () => {
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot
  )
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const user = rootData?.user ?? null
  const userId = user?.sub
  const linksQuery = useLinksQuery(userId)
  const createOrUpdateSavedLink = useConvexMutation(api.links.createOrUpdate)
  const updateSavedLinkMetadata = useConvexMutation(api.links.updateMeta)
  const applySavedLinkMetadataOperation = useConvexMutation(
    api.links.applyMetadataOperation
  )
  const deleteSavedLink = useConvexMutation(api.links.deleteById)
  const clearSavedLinks = useConvexMutation(api.users.clearLinks)

  const createLink = useCallback(
    async (item: LinkViewItem) =>
      await createServerLink({
        targetUrl: item.url,
        title: item.title ?? item.url,
        metadata: item.metadata!,
        createLink: async ({ url, title, metadata }) => {
          const operationId = crypto.randomUUID()
          const result = await withMutationTimeout(
            createOrUpdateSavedLink({
              operationId,
              url,
              title,
              meta: JSON.stringify(metadata),
            })
          )
          return result.id
        },
      }),
    [createOrUpdateSavedLink]
  )
  const updateLink = useCallback(
    async (item: LinkViewItem, operation?: LinkMetadataOperation) => {
      if (!item.id || !item.metadata) {
        return
      }
      const linkId = item.id
      const metadata = item.metadata
      const operationId = crypto.randomUUID()
      if (operation) {
        switch (operation.kind) {
          case "markOpened":
            if (!operation.linkUrl) {
              throw new Error("Link URL is required")
            }
            const openedLinkUrl = operation.linkUrl
            await withMutationTimeout(
              applySavedLinkMetadataOperation({
                operationId,
                id: linkId,
                operation: {
                  kind: "markOpened",
                  linkUrl: openedLinkUrl,
                },
              })
            )
            return
          case "cacheMirrors":
            if (!operation.lazyItemUrl || !operation.mirrors) {
              throw new Error("Mirror operation is incomplete")
            }
            const lazyItemUrl = operation.lazyItemUrl
            const mirrors = operation.mirrors
            await withMutationTimeout(
              applySavedLinkMetadataOperation({
                operationId,
                id: linkId,
                operation: {
                  kind: "cacheMirrors",
                  lazyItemUrl,
                  mirrorsJson: JSON.stringify(mirrors),
                },
              })
            )
            return
          case "removeExtractedLink":
            if (!operation.linkKey || !operation.linkUrl) {
              throw new Error("Remove operation is incomplete")
            }
            const linkKey = operation.linkKey
            const removedLinkUrl = operation.linkUrl
            await withMutationTimeout(
              applySavedLinkMetadataOperation({
                operationId,
                id: linkId,
                operation: {
                  kind: "removeExtractedLink",
                  linkKey,
                  linkUrl: removedLinkUrl,
                },
              })
            )
            return
          case "replaceExtraction":
            if (!operation.expectedExtraction || !operation.extractedLinks) {
              throw new Error("Extraction operation is incomplete")
            }
            const expectedExtraction = operation.expectedExtraction
            const extractedLinks = operation.extractedLinks
            await withMutationTimeout(
              applySavedLinkMetadataOperation({
                operationId,
                id: linkId,
                operation: {
                  kind: "replaceExtraction",
                  expectedExtractionJson: JSON.stringify(expectedExtraction),
                  extractedLinksJson: JSON.stringify(extractedLinks),
                },
              })
            )
            return
        }
      }
      await withMutationTimeout(
        updateSavedLinkMetadata({
          operationId,
          id: linkId,
          meta: JSON.stringify(toJsonMetadata(metadata)),
        })
      )
    },
    [applySavedLinkMetadataOperation, updateSavedLinkMetadata]
  )

  const adapter = useMemo(
    () =>
      createServerLinksAdapter({
        read: () => EMPTY_LINKS,
        create: createLink,
        update: updateLink,
        delete: async (id) => {
          await withMutationTimeout(deleteSavedLink({ id }))
        },
        clear: async () => {
          await withMutationTimeout(clearSavedLinks({}))
        },
      }),
    [clearSavedLinks, createLink, deleteSavedLink, updateLink]
  )
  const identity = userId ?? "signed-out"
  const synchronization = useMemo(
    () => createSavedLinkSynchronization(adapter, identity, EMPTY_LINKS),
    [adapter, identity]
  )

  useEffect(() => {
    synchronization
      .synchronize({
        adapter,
        identity,
        cachedItems: EMPTY_LINKS,
        remote: linksQuery.isLive ? linksQuery.data : undefined,
      })
      .catch((error) => console.error(error))
  }, [adapter, identity, linksQuery.data, linksQuery.isLive, synchronization])

  const links = useSyncExternalStore(
    synchronization.subscribe,
    synchronization.getSnapshot,
    () => EMPTY_LINKS
  )
  const savedLinks = useMemo(() => links.map(toSavedLinkListItem), [links])
  const mutations = useLinksMutations(synchronization)
  const pagination = useLinksPaginationAndSort(savedLinks)
  const actions: LinksActions = {
    add: mutations.addLink,
    remove: mutations.remove,
    updateLinks: mutations.updateLinks,
    markOpened: mutations.markLinkAsOpened,
    cacheResolvedMirrors: mutations.cacheResolvedMirrors,
    removeLink: mutations.removeLink,
  }

  return {
    links: savedLinks,
    actions,
    user,
    isLoading: linksQuery.isLoading,
    isHydrating: Boolean(userId && !hasHydrated && links.length === 0),
    ...pagination,
  }
}
