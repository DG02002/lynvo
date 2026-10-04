import { useEffect, useMemo } from "react"
import { useLocation, useSearchParams } from "react-router"

import {
  getGalleryGroups,
  type GalleryGroup,
} from "~/features/links/media-artwork"
import type { SavedLinkListItem } from "~/features/links/types"
import { useMediaView } from "~/features/site/settings/media-view-preference"
import { SAVE_GROUP_SEARCH_PARAM } from "~/lib/paths"

import {
  createSaveListScrollLocationState,
  getSaveListScrollPosition,
} from "./use-save-list-fullscreen"

interface UseGalleryGroupRouteOptions {
  links: SavedLinkListItem[]
  isFolderRoute: boolean
  isPending: boolean
}

interface GalleryGroupRouteState {
  isGalleryMediaView: boolean
  galleryGroups: readonly GalleryGroup[] | undefined
  openGalleryGroup: GalleryGroup | undefined
  isGroupRoute: boolean
  isImmersiveRoute: boolean
  exitGroup: () => void
  openGroup: (groupKey: string, scrollPosition: number) => void
}

export const useGalleryGroupRoute = ({
  links,
  isFolderRoute,
  isPending,
}: UseGalleryGroupRouteOptions): GalleryGroupRouteState => {
  const mediaView = useMediaView()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isGalleryMediaView = mediaView === "gallery"
  const requestedGroupKey = searchParams.get(SAVE_GROUP_SEARCH_PARAM)
  const galleryGroupKey = isGalleryMediaView ? requestedGroupKey : null
  const galleryGroups = useMemo(
    () =>
      isGalleryMediaView && !isFolderRoute
        ? getGalleryGroups(links)
        : undefined,
    [isGalleryMediaView, isFolderRoute, links]
  )
  const openGalleryGroup = galleryGroups?.find(
    (group) => group.key === galleryGroupKey
  )
  const isGroupRoute = galleryGroupKey !== null
  const isImmersiveRoute = isFolderRoute || isGroupRoute

  // A group param the page cannot render (list view selected, unknown
  // group) is cleared instead of lingering: the site layout drops chrome
  // for /save?group=… and must never do that for an ignored param.
  useEffect(() => {
    if (
      requestedGroupKey &&
      (!isGalleryMediaView || (!isPending && !openGalleryGroup))
    ) {
      setSearchParams({}, { replace: true })
    }
  }, [
    isGalleryMediaView,
    isPending,
    openGalleryGroup,
    requestedGroupKey,
    setSearchParams,
  ])

  const savedScrollPosition = getSaveListScrollPosition(location.state) ?? 0
  const exitGroup = () =>
    setSearchParams(
      {},
      {
        replace: true,
        state: createSaveListScrollLocationState(savedScrollPosition),
      }
    )
  const openGroup = (groupKey: string, scrollPosition: number) =>
    setSearchParams(
      { [SAVE_GROUP_SEARCH_PARAM]: groupKey },
      { state: createSaveListScrollLocationState(scrollPosition) }
    )

  return {
    isGalleryMediaView,
    galleryGroups,
    openGalleryGroup,
    isGroupRoute,
    isImmersiveRoute,
    exitGroup,
    openGroup,
  }
}
