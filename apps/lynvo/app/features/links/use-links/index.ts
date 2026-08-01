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
  linksToLinkViewItems,
  readLinksCache,
  readLocalLinks,
  LINKS_KEY,
  LINKS_MAX_LIMIT,
} from "./cache"
import { useLinksQuery } from "./query"
import { useLinksMutations } from "./mutations"
import { useLinksPaginationAndSort } from "./pagination"
import { useDraftLinks } from "./drafts"
import type { LinksActions } from "./actions"
import {
  createServerLinksAdapter,
  createLocalLinksAdapter,
  createLinksPersistence,
} from "./persistence"
import { createServerLink } from "./link-server"

export const useLinks = () => {
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const user = rootData?.user ?? null
  const userId = user?.sub
  const cachedLinks = useMemo(() => readLinksCache(userId), [userId])
  const cachedItems = useMemo(
    () =>
      userId
        ? linksToLinkViewItems(cachedLinks?.results ?? [])
        : readLocalLinks(),
    [cachedLinks?.results, userId]
  )
  const linksQuery = useLinksQuery(userId, cachedLinks)

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
  const updateLink = useCallback(async (item: (typeof cachedItems)[number]) => {
    if (!item.id || !item.metadata) {
      return
    }
    await Effect.runPromise(
      client.links.updateMeta({
        params: { linkId: item.id },
        payload: { meta: structuredClone(item.metadata) },
      })
    )
  }, [])

  const adapter = useMemo(
    () =>
      userId
        ? createServerLinksAdapter({
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
          })
        : createLocalLinksAdapter({
            storage: localStorage,
            storageKey: LINKS_KEY,
            maximumItems: LINKS_MAX_LIMIT,
            read: readLocalLinks,
          }),
    [cachedItems, createLink, updateLink, userId]
  )
  const identity = userId ?? "anonymous"
  const persistenceRef = useRef<LinksPersistence | undefined>(undefined)
  if (!persistenceRef.current) {
    persistenceRef.current = createLinksPersistence(
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
      linksToLinkViewItems(
        linksQuery.data?.results ?? [],
        persistence.getSnapshot()
      ),
      linksQuery.data?.version
    )
  }, [linksQuery.data, linksQuery.isLive, persistence, userId])

  const links = useSyncExternalStore(
    persistence.subscribe,
    persistence.getSnapshot,
    persistence.getSnapshot
  )
  const combinedLinks = useDraftLinks(links)
  const mutations = useLinksMutations(persistence)
  const pagination = useLinksPaginationAndSort(combinedLinks)
  const actions: LinksActions = {
    add: mutations.addLink,
    remove: mutations.remove,
    updateLinks: mutations.updateLinks,
    markWatched: mutations.markLinkAsWatched,
    cacheResolvedMirrors: mutations.cacheResolvedMirrors,
    removeLink: mutations.removeLink,
    setPlayableItemAsCurrent: mutations.setPlayableItemAsCurrent,
  }

  return {
    links: combinedLinks,
    actions,
    user,
    isLoading: linksQuery.isLoading,
    isHydrating: Boolean(userId && linksQuery.isLoading && links.length === 0),
    ...pagination,
  }
}
