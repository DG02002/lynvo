import { useEffect, useMemo } from "react"
import { useSearchParams } from "react-router"
import { getHybridCardGroups } from "~/features/links/media-artwork/hybrid-card-grouping"
import { useMediaView } from "~/features/site/settings/media-view-preference"
import type { SavedLinkListItem } from "~/features/links/types"

interface UseHybridGroupRouteOptions {
  links: SavedLinkListItem[]
  isFolderRoute: boolean
  isPending: boolean
}

interface HybridGroupRouteState {
  isHybridMediaView: boolean
  hybridCardGroups: readonly HybridCardGroup[] | undefined
  openHybridGroup: HybridCardGroup | undefined
  isGroupRoute: boolean
  isImmersiveRoute: boolean
  exitGroup: () => void
  openGroup: (groupKey: string) => void
}

export const useHybridGroupRoute = ({
  links,
  isFolderRoute,
  isPending,
}: UseHybridGroupRouteOptions): HybridGroupRouteState => {
  const mediaView = useMediaView()
  const [searchParams, setSearchParams] = useSearchParams()
  const isHybridMediaView = mediaView === "hybrid"
  const hybridGroupKey = isHybridMediaView ? searchParams.get("group") : null
  const hybridCardGroups = useMemo(
    () =>
      isHybridMediaView && !isFolderRoute
        ? getHybridCardGroups(links)
        : undefined,
    [isHybridMediaView, isFolderRoute, links]
  )
  const openHybridGroup = hybridCardGroups?.find(
    (group) => group.key === hybridGroupKey
  )
  const isGroupRoute = hybridGroupKey !== null
  const isImmersiveRoute = isFolderRoute || isGroupRoute

  useEffect(() => {
    if (hybridGroupKey && !isPending && !openHybridGroup) {
      setSearchParams({}, { replace: true })
    }
  }, [hybridGroupKey, isPending, openHybridGroup, setSearchParams])

  const exitGroup = () => setSearchParams({}, { replace: true })
  const openGroup = (groupKey: string) => setSearchParams({ group: groupKey })

  return {
    isHybridMediaView,
    hybridCardGroups,
    openHybridGroup,
    isGroupRoute,
    isImmersiveRoute,
    exitGroup,
    openGroup,
  }
}
