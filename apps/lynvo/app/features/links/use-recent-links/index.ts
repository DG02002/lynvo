import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"
import { Effect } from "effect"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import { client } from "~/lib/effect/api/client"
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
  createServerRecentLinksAdapter,
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

  const createRecentLink = useCallback(
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
  const updateRecentLink = useCallback(
    async (item: (typeof cachedItems)[number]) => {
      if (!item.id || !item.metadata) {
        return
      }
      await Effect.runPromise(
        client.links.updateMeta({
          params: { linkId: item.id },
          payload: { meta: structuredClone(item.metadata) },
        })
      )
    },
    []
  )

  const adapter = useMemo(
    () =>
      userId
        ? createServerRecentLinksAdapter({
            read: () => cachedItems,
            create: createRecentLink,
            update: updateRecentLink,
            delete: async (id) => {
              await Effect.runPromise(
                client.links.delete({ params: { linkId: id } })
              )
            },
            clear: async () => {
              await Effect.runPromise(client.settings.clearRecentLinks())
            },
          })
        : createLocalRecentLinksAdapter({
            storage: localStorage,
            storageKey: RECENTS_KEY,
            maximumItems: RECENTS_MAX_LIMIT,
            read: readLocalRecents,
          }),
    [cachedItems, createRecentLink, updateRecentLink, userId]
  )
  const identity = userId ?? "anonymous"
  const persistenceRef = useRef<RecentLinksPersistence | undefined>(undefined)
  if (!persistenceRef.current) {
    persistenceRef.current = createRecentLinksPersistence(
      adapter,
      cachedItems,
      identity
    )
  } else {
    persistenceRef.current.reset(adapter, identity, cachedItems)
  }
  const persistence = persistenceRef.current

  useEffect(() => {
    persistence.load().catch((error) => console.error(error))
  }, [adapter, identity, persistence])

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
