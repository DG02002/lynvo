import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import { Effect } from "effect"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import { client } from "~/lib/effect/api/client"
import { linksToLinkViewItems, readLinksCache } from "./cache"
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
import { useSavedLinkRealtimeSynchronization } from "./realtime-synchronization"

const EMPTY_LINKS: LinkViewItem[] = []
const subscribeToHydration = () => () => undefined
const getHydratedSnapshot = () => true
const getServerHydratedSnapshot = () => false

const toJsonMetadata = (metadata: LinkMetadata): LinkMetadata =>
  JSON.parse(JSON.stringify(metadata)) as LinkMetadata

const toSavedLinkListItem = (item: LinkViewItem): SavedLinkListItem => ({
  ...item,
  kind: "saved",
})

export const useLinks = () => {
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot
  )
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const user = rootData?.user ?? null
  const userId = user?.sub
  const cachedLinks = useMemo(() => readLinksCache(userId), [userId])
  const cachedItems = useMemo(
    () => linksToLinkViewItems(cachedLinks?.results ?? []),
    [cachedLinks?.results]
  )
  const linksQuery = useLinksQuery(userId, cachedLinks)
  useSavedLinkRealtimeSynchronization(userId, linksQuery.data?.revision)

  const createLink = useCallback(
    async (item: (typeof cachedItems)[number]) =>
      await createServerLink({
        targetUrl: item.url,
        title: item.title ?? item.url,
        metadata: item.metadata!,
        createLink: ({ url, title, metadata }) =>
          Effect.runPromise(
            client.links.create({ payload: { url, title, meta: metadata } })
          ),
      }),
    []
  )
  const updateLink = useCallback(
    async (
      item: (typeof cachedItems)[number],
      operation?: LinkMetadataOperation
    ) => {
      if (!item.id || !item.metadata) {
        return
      }
      if (operation) {
        switch (operation.kind) {
          case "markOpened":
            if (!operation.linkUrl) {
              throw new Error("Link URL is required")
            }
            await Effect.runPromise(
              client.links.applyMetadataOperation({
                params: { linkId: item.id },
                payload: { kind: operation.kind, linkUrl: operation.linkUrl },
              })
            )
            return
          case "cacheMirrors":
            if (!operation.lazyItemUrl || !operation.mirrors) {
              throw new Error("Mirror operation is incomplete")
            }
            await Effect.runPromise(
              client.links.applyMetadataOperation({
                params: { linkId: item.id },
                payload: {
                  kind: operation.kind,
                  lazyItemUrl: operation.lazyItemUrl,
                  mirrors: operation.mirrors,
                },
              })
            )
            return
          case "removeExtractedLink":
            if (!operation.linkKey || !operation.linkUrl) {
              throw new Error("Remove operation is incomplete")
            }
            await Effect.runPromise(
              client.links.applyMetadataOperation({
                params: { linkId: item.id },
                payload: {
                  kind: operation.kind,
                  linkKey: operation.linkKey,
                  linkUrl: operation.linkUrl,
                },
              })
            )
            return
          case "replaceExtraction":
            if (!operation.expectedExtraction || !operation.extractedLinks) {
              throw new Error("Extraction operation is incomplete")
            }
            await Effect.runPromise(
              client.links.applyMetadataOperation({
                params: { linkId: item.id },
                payload: {
                  kind: operation.kind,
                  expectedExtraction: operation.expectedExtraction,
                  extractedLinks: operation.extractedLinks,
                },
              })
            )
            return
        }
      }
      await Effect.runPromise(
        client.links.updateMeta({
          params: { linkId: item.id },
          payload: { meta: toJsonMetadata(item.metadata) },
        })
      )
    },
    []
  )

  const adapter = useMemo(
    () =>
      createServerLinksAdapter({
        read: () => cachedItems,
        create: createLink,
        update: updateLink,
        delete: async (id) => {
          await Effect.runPromise(
            client.links.delete({ params: { linkId: id } })
          )
        },
        clear: async () => {
          await Effect.runPromise(client.settings.clearLinks())
        },
      }),
    [cachedItems, createLink, updateLink, userId]
  )
  const identity = userId ?? "signed-out"
  const synchronization = useMemo(
    () => createSavedLinkSynchronization(adapter, identity, cachedItems),
    [adapter, cachedItems, identity]
  )

  useEffect(() => {
    synchronization
      .synchronize({
        adapter,
        identity,
        cachedItems,
        remote: linksQuery.isLive ? linksQuery.data : undefined,
      })
      .catch((error) => console.error(error))
  }, [
    adapter,
    cachedItems,
    identity,
    linksQuery.data,
    linksQuery.isLive,
    synchronization,
  ])

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
