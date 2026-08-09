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
import { linksToLinkViewItems, readLinksCache } from "./cache"
import { useLinksQuery } from "./query"
import { useLinksMutations } from "./mutations"
import { useLinksPaginationAndSort } from "./pagination"
import { useDraftLinks } from "./drafts"
import type { LinksActions } from "./actions"
import { createServerLinksAdapter, createLinksPersistence } from "./persistence"
import { createServerLink } from "./link-server"
import type { LinkMetadata, LinkViewItem } from "~/features/links/types"

const EMPTY_LINKS: LinkViewItem[] = []
const subscribeToHydration = () => () => undefined
const getHydratedSnapshot = () => true
const getServerHydratedSnapshot = () => false

const toJsonMetadata = (metadata: LinkMetadata): LinkMetadata =>
  JSON.parse(JSON.stringify(metadata)) as LinkMetadata

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
        payload: { meta: toJsonMetadata(item.metadata) },
      })
    )
  }, [])

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
    () => EMPTY_LINKS
  )
  const combinedLinks = useDraftLinks(links)
  const mutations = useLinksMutations(persistence)
  const pagination = useLinksPaginationAndSort(combinedLinks)
  const actions: LinksActions = {
    add: mutations.addLink,
    remove: mutations.remove,
    updateLinks: mutations.updateLinks,
    markOpened: mutations.markLinkAsOpened,
    cacheResolvedMirrors: mutations.cacheResolvedMirrors,
    removeLink: mutations.removeLink,
  }

  return {
    links: combinedLinks,
    actions,
    user,
    isLoading: linksQuery.isLoading,
    isHydrating: Boolean(userId && !hasHydrated && links.length === 0),
    ...pagination,
  }
}
