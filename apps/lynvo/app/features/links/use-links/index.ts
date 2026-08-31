import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import {
  LINKS_OFFLINE_POLL_INTERVAL_MS,
  LINKS_REFETCH_DEBOUNCE_MS,
} from "~/lib/constants"
import {
  useOptionalRealtime,
  type RealtimeContextValue,
} from "~/context/realtime-context"
import { linksDataApi, savedLinkApiRecordToViewItem } from "./api"
import { createLinksSnapshotStore } from "./links-store"
import { createLinksMutations } from "./mutations"
import type { LinksActions } from "./actions"
import type { LinkViewItem, SavedLinkListItem } from "~/features/links/types"

const EMPTY_LINKS: LinkViewItem[] = []
const subscribeToHydration = () => () => undefined
const getHydratedSnapshot = () => true
const getServerHydratedSnapshot = () => false

declare global {
  interface UseLinksOptions {
    readonly initialItems?: LinkViewItem[]
    readonly initialDataVersion?: number
    readonly hasInitialSnapshot?: boolean
  }

  interface UseLinksRuntime {
    readonly user: { readonly sub: string } | null
    readonly realtime?: RealtimeContextValue
  }
}

interface UseLinksRefreshOptions {
  initialSnapshot: UseLinksOptions
  userId: string | undefined
  realtime: RealtimeContextValue | undefined
  store: ReturnType<typeof createLinksSnapshotStore>
}

interface UseLinksRefreshResult {
  isInitialLoadComplete: boolean
  scheduleRefetch: () => void
}

interface UseInitialLinksLoadOptions {
  hasInitialSnapshot: boolean | undefined
  userId: string | undefined
  applyFetchedSnapshot: () => Promise<void>
}

interface UseRealtimeLinksRefreshOptions {
  applyFetchedSnapshot: () => Promise<void>
  realtime: RealtimeContextValue | undefined
  store: ReturnType<typeof createLinksSnapshotStore>
  userId: string | undefined
}

interface UseOfflineLinksRefreshOptions {
  applyFetchedSnapshot: () => Promise<void>
  realtime: RealtimeContextValue | undefined
  userId: string | undefined
}

interface UseLinksRefetchTimerOptions {
  applyFetchedSnapshot: () => Promise<void>
}

interface UseLinksMutationActionsOptions {
  scheduleRefetch: () => void
  store: ReturnType<typeof createLinksSnapshotStore>
}

interface UseLinksSnapshotOptions {
  hasInitialSnapshot: boolean | undefined
  store: ReturnType<typeof createLinksSnapshotStore>
}

interface UseLinksSnapshotResult {
  links: SavedLinkListItem[]
  dataVersion: number
}

const toSavedLinkListItem = (item: LinkViewItem): SavedLinkListItem => ({
  ...item,
  kind: "saved",
})

const refreshLinksSafely = (
  applyFetchedSnapshot: () => Promise<void>,
  message: string
): void => {
  void applyFetchedSnapshot().catch((error) => console.error(message, error))
}

const useInitialLinksLoad = ({
  hasInitialSnapshot,
  userId,
  applyFetchedSnapshot,
}: UseInitialLinksLoadOptions): boolean => {
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(
    Boolean(hasInitialSnapshot)
  )
  useEffect(() => {
    if (!userId) {
      setIsInitialLoadComplete(false)
      return
    }
    let didCancel = false
    if (!hasInitialSnapshot) {
      setIsInitialLoadComplete(false)
    }
    applyFetchedSnapshot()
      .catch((error) => console.error("Unable to load saved links", error))
      .finally(() => {
        if (!didCancel) {
          setIsInitialLoadComplete(true)
        }
      })
    return () => {
      didCancel = true
    }
  }, [applyFetchedSnapshot, hasInitialSnapshot, userId])
  return isInitialLoadComplete
}

const useRealtimeLinksRefresh = ({
  applyFetchedSnapshot,
  realtime,
  store,
  userId,
}: UseRealtimeLinksRefreshOptions): void => {
  useEffect(() => {
    if (!userId || !realtime) {
      return
    }
    return realtime.subscribe((message) => {
      if (message.type === "data-changed") {
        if (message.payload.version > store.getVersion()) {
          refreshLinksSafely(
            applyFetchedSnapshot,
            "Unable to refresh saved links"
          )
        }
        return
      }
      if (
        message.type === "session_hello" &&
        message.dataVersion !== undefined &&
        message.dataVersion > store.getVersion()
      ) {
        refreshLinksSafely(
          applyFetchedSnapshot,
          "Unable to refresh saved links"
        )
      }
    })
  }, [applyFetchedSnapshot, realtime, store, userId])
}

const useOfflineLinksRefresh = ({
  applyFetchedSnapshot,
  realtime,
  userId,
}: UseOfflineLinksRefreshOptions): void => {
  useEffect(() => {
    if (!userId || realtime?.status === "connected") {
      return
    }
    const intervalId = window.setInterval(() => {
      refreshLinksSafely(applyFetchedSnapshot, "Unable to refresh saved links")
    }, LINKS_OFFLINE_POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [applyFetchedSnapshot, realtime?.status, userId])
}

const useLinksRefetchTimer = ({
  applyFetchedSnapshot,
}: UseLinksRefetchTimerOptions): (() => void) => {
  const refetchTimerRef = useRef<number | undefined>(undefined)
  const scheduleRefetch = useCallback(() => {
    window.clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = window.setTimeout(() => {
      refreshLinksSafely(applyFetchedSnapshot, "Unable to refresh saved links")
    }, LINKS_REFETCH_DEBOUNCE_MS)
  }, [applyFetchedSnapshot])
  useEffect(
    () => () => {
      window.clearTimeout(refetchTimerRef.current)
    },
    []
  )
  return scheduleRefetch
}

const useLinksRefresh = ({
  initialSnapshot,
  userId,
  realtime,
  store,
}: UseLinksRefreshOptions): UseLinksRefreshResult => {
  const fetchSequenceRef = useRef(0)
  const applyFetchedSnapshot = useCallback(async () => {
    if (!userId) {
      return
    }
    const sequence = fetchSequenceRef.current + 1
    fetchSequenceRef.current = sequence
    const response = await linksDataApi.listSavedLinks()
    if (sequence !== fetchSequenceRef.current) {
      return
    }
    const items = response.links.flatMap((record) => {
      const viewItem = savedLinkApiRecordToViewItem(record)
      return viewItem ? [viewItem] : []
    })
    store.applyServerSnapshot(items, response.dataVersion)
  }, [store, userId])
  const scheduleRefetch = useLinksRefetchTimer({ applyFetchedSnapshot })
  const isInitialLoadComplete = useInitialLinksLoad({
    hasInitialSnapshot: initialSnapshot.hasInitialSnapshot,
    userId,
    applyFetchedSnapshot,
  })
  useRealtimeLinksRefresh({
    applyFetchedSnapshot,
    realtime,
    store,
    userId,
  })
  useOfflineLinksRefresh({ applyFetchedSnapshot, realtime, userId })
  return { isInitialLoadComplete, scheduleRefetch }
}

const useLinksMutationActions = ({
  scheduleRefetch,
  store,
}: UseLinksMutationActionsOptions): LinksActions => {
  const initialMutationChain = useMemo(() => Promise.resolve(), [])
  const mutationChainRef = useRef<Promise<unknown>>(initialMutationChain)
  const runExclusive = useCallback(
    <Result>(operation: () => Promise<Result>): Promise<Result> => {
      const execution = mutationChainRef.current.then(operation, operation)
      mutationChainRef.current = execution.catch(() => undefined)
      return execution
    },
    []
  )
  const mutations = useMemo(
    () =>
      createLinksMutations({
        store,
        runExclusive,
        onSettled: scheduleRefetch,
      }),
    [runExclusive, scheduleRefetch, store]
  )
  return {
    add: mutations.addLink,
    enqueue: mutations.enqueueLink,
    remove: mutations.remove,
    updateLinks: mutations.updateLinks,
    markOpened: mutations.markLinkAsOpened,
    cacheResolvedMirrors: mutations.cacheResolvedMirrors,
    removeLink: mutations.removeLink,
    setArtwork: mutations.setArtwork,
  }
}

const useLinksSnapshot = ({
  hasInitialSnapshot,
  store,
}: UseLinksSnapshotOptions): UseLinksSnapshotResult => {
  const links = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    hasInitialSnapshot ? store.getSnapshot : () => EMPTY_LINKS
  )
  const dataVersion = useSyncExternalStore(
    store.subscribe,
    store.getVersion,
    hasInitialSnapshot ? store.getVersion : () => 0
  )
  const savedLinks = useMemo(() => links.map(toSavedLinkListItem), [links])
  return { links: savedLinks, dataVersion }
}

export const useLinksWithRuntime = (
  options: UseLinksOptions,
  runtime: UseLinksRuntime
) => {
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot
  )
  const { user, realtime } = runtime
  const userId = user?.sub
  const identity = userId ?? "signed-out"
  const initialSnapshot = useRef(options).current
  const store = useMemo(
    () =>
      createLinksSnapshotStore(
        initialSnapshot.initialItems,
        initialSnapshot.initialDataVersion
      ),
    [identity, initialSnapshot]
  )
  const { isInitialLoadComplete, scheduleRefetch } = useLinksRefresh({
    initialSnapshot,
    userId,
    realtime,
    store,
  })
  const actions = useLinksMutationActions({ scheduleRefetch, store })
  const { links, dataVersion } = useLinksSnapshot({
    hasInitialSnapshot: initialSnapshot.hasInitialSnapshot,
    store,
  })

  return {
    links,
    actions,
    user,
    dataVersion,
    isLoading: Boolean(userId && !isInitialLoadComplete),
    isHydrating: Boolean(
      userId &&
      !hasHydrated &&
      !initialSnapshot.hasInitialSnapshot &&
      links.length === 0
    ),
  }
}

export const useLinks = (options: UseLinksOptions = {}) => {
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const realtime = useOptionalRealtime()
  return useLinksWithRuntime(options, {
    user: rootData?.user ?? null,
    realtime,
  })
}
