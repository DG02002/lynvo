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
import { useOptionalRealtime } from "~/context/realtime-context"
import { linksDataApi, savedLinkApiRecordToViewItem } from "./api"
import { createLinksSnapshotStore } from "./links-store"
import { createLinksMutations } from "./mutations"
import type { LinksActions } from "./actions"
import type { LinkViewItem, SavedLinkListItem } from "~/features/links/types"
import type { RealtimeContextValue } from "~/context/realtime-context"

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

const toSavedLinkListItem = (item: LinkViewItem): SavedLinkListItem => ({
  ...item,
  kind: "saved",
})

export const useLinksWithRuntime = (
  options: UseLinksOptions,
  runtime: UseLinksRuntime
) => {
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot
  )
  const user = runtime.user
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
  const realtime = runtime.realtime
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(
    Boolean(initialSnapshot.hasInitialSnapshot)
  )
  const fetchSequenceRef = useRef(0)
  const refetchTimerRef = useRef<number | undefined>(undefined)
  const initialMutationChain = useMemo(() => Promise.resolve(), [])
  const mutationChainRef = useRef<Promise<unknown>>(initialMutationChain)

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

  const scheduleRefetch = useCallback(() => {
    window.clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = window.setTimeout(() => {
      applyFetchedSnapshot().catch((error) =>
        console.error("Unable to refresh saved links", error)
      )
    }, LINKS_REFETCH_DEBOUNCE_MS)
  }, [applyFetchedSnapshot])

  useEffect(() => {
    if (!userId) {
      setIsInitialLoadComplete(false)
      return
    }
    let didCancel = false
    if (!initialSnapshot.hasInitialSnapshot) {
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
  }, [applyFetchedSnapshot, initialSnapshot, store, userId])

  useEffect(() => {
    if (!userId || !realtime) {
      return
    }
    return realtime.subscribe((message) => {
      if (
        message.type === "data-changed" &&
        message.payload.version > store.getVersion()
      ) {
        applyFetchedSnapshot().catch((error) =>
          console.error("Unable to refresh saved links", error)
        )
      } else if (
        message.type === "session_hello" &&
        message.dataVersion !== undefined &&
        message.dataVersion > store.getVersion()
      ) {
        applyFetchedSnapshot().catch((error) =>
          console.error("Unable to refresh saved links", error)
        )
      }
    })
  }, [applyFetchedSnapshot, realtime, store, userId])

  useEffect(() => {
    if (!userId || realtime?.status === "connected") {
      return
    }
    const intervalId = window.setInterval(() => {
      applyFetchedSnapshot().catch((error) =>
        console.error("Unable to refresh saved links", error)
      )
    }, LINKS_OFFLINE_POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [applyFetchedSnapshot, realtime?.status, userId])

  useEffect(
    () => () => {
      window.clearTimeout(refetchTimerRef.current)
    },
    []
  )

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

  const links = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    initialSnapshot.hasInitialSnapshot ? store.getSnapshot : () => EMPTY_LINKS
  )
  const dataVersion = useSyncExternalStore(
    store.subscribe,
    store.getVersion,
    initialSnapshot.hasInitialSnapshot ? store.getVersion : () => 0
  )
  const savedLinks = useMemo(() => links.map(toSavedLinkListItem), [links])
  const actions: LinksActions = {
    add: mutations.addLink,
    enqueue: mutations.enqueueLink,
    remove: mutations.remove,
    updateLinks: mutations.updateLinks,
    markOpened: mutations.markLinkAsOpened,
    cacheResolvedMirrors: mutations.cacheResolvedMirrors,
    removeLink: mutations.removeLink,
    setArtwork: mutations.setArtwork,
  }

  return {
    links: savedLinks,
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
