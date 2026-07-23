import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import { useMutation } from "convex/react"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import { api } from "../../../../convex/_generated/api"
import {
  linksToRecentLinkViewItems,
  readLinksCache,
  readLocalRecents,
  RECENTS_KEY,
  RECENTS_MAX_LIMIT,
} from "./cache"
import { useRecentLinksQuery } from "./query"
import { useRecentLinksMutations } from "./mutations"
import { useRecentLinksPaginationAndSort } from "./pagination"
import { useDraftRecentLinks } from "./drafts"
import type { RecentLinksActions } from "./actions"
import {
  createConvexRecentLinksAdapter,
  createLocalRecentLinksAdapter,
  createRecentLinksPersistence,
} from "./persistence"
import { createServerLink } from "./recent-link-server"

export const useRecentLinks = () => {
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const user = rootData?.user ?? null
  const userId = user?.sub
  const cachedLinks = useMemo(() => readLinksCache(userId), [userId])
  const cachedItems = useMemo(
    () =>
      userId
        ? linksToRecentLinkViewItems(cachedLinks?.results ?? [])
        : readLocalRecents(),
    [cachedLinks?.results, userId]
  )
  const linksQuery = useRecentLinksQuery(userId, cachedLinks)
  const createLink = useMutation(api.links.createOrUpdate)
  const deleteLink = useMutation(api.links.deleteById)
  const clearLinks = useMutation(api.users.clearRecentCards)
  const updateLinkMeta = useMutation(api.links.updateMeta)

  const createRecentLink = useCallback(
    async (item: (typeof cachedItems)[number]) =>
      await createServerLink({
        targetUrl: item.url,
        title: item.title ?? item.url,
        metadata: item.metadata!,
        createLink: ({ url, title, metadata }) =>
          createLink({ url, title, meta: JSON.stringify(metadata) }),
      }),
    [createLink]
  )
  const updateRecentLink = useCallback(
    async (item: (typeof cachedItems)[number]) => {
      if (!item.id || !item.metadata) {
        return
      }
      await updateLinkMeta({
        id: item.id,
        meta: JSON.stringify(structuredClone(item.metadata)),
      })
    },
    [updateLinkMeta]
  )

  const persistence = useMemo(() => {
    const adapter = userId
      ? createConvexRecentLinksAdapter({
          read: () => cachedItems,
          create: createRecentLink,
          update: updateRecentLink,
          delete: async (id) => {
            await deleteLink({ id })
          },
          clear: async () => {
            await clearLinks({})
          },
        })
      : createLocalRecentLinksAdapter({
          storage: localStorage,
          storageKey: RECENTS_KEY,
          maximumItems: RECENTS_MAX_LIMIT,
          read: readLocalRecents,
        })
    return createRecentLinksPersistence(adapter, cachedItems)
  }, [
    cachedItems,
    clearLinks,
    createRecentLink,
    deleteLink,
    updateRecentLink,
    userId,
  ])

  useEffect(() => {
    persistence.load().catch((error) => console.error(error))
  }, [persistence])

  useEffect(() => {
    if (!userId || !linksQuery.isLive) {
      return
    }
    persistence.reconcile(
      linksToRecentLinkViewItems(
        linksQuery.data?.results ?? [],
        persistence.getSnapshot()
      ),
      linksQuery.data?.version
    )
  }, [linksQuery.data, linksQuery.isLive, persistence, userId])

  const recents = useSyncExternalStore(
    persistence.subscribe,
    persistence.getSnapshot,
    persistence.getSnapshot
  )
  const combinedRecents = useDraftRecentLinks(recents)
  const mutations = useRecentLinksMutations(persistence)
  const pagination = useRecentLinksPaginationAndSort(combinedRecents)
  const actions: RecentLinksActions = {
    add: mutations.addRecent,
    remove: mutations.removeRecent,
    updateLinks: mutations.updateRecentLinks,
    markWatched: mutations.markLinkAsWatched,
    cacheResolvedMirrors: mutations.cacheResolvedMirrors,
    removeLink: mutations.removeLink,
    setPlayableItemAsCurrent: mutations.setPlayableItemAsCurrent,
  }

  return {
    recents: combinedRecents,
    actions,
    user,
    isLoading: linksQuery.isLoading,
    isHydrating: Boolean(
      userId && linksQuery.isLoading && recents.length === 0
    ),
    ...pagination,
  }
}
