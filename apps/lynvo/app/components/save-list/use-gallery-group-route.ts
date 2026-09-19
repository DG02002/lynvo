import { useEffect, useMemo } from "react"
import { useSearchParams } from "react-router"

import {
  getGalleryGroups,
  type GalleryGroup,
} from "~/features/links/media-artwork"
import type { SavedLinkListItem } from "~/features/links/types"
import { useMediaView } from "~/features/site/settings/media-view-preference"

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
  openGroup: (groupKey: string) => void
}

export const useGalleryGroupRoute = ({
  links,
  isFolderRoute,
  isPending,
}: UseGalleryGroupRouteOptions): GalleryGroupRouteState => {
  const mediaView = useMediaView()
  const [searchParams, setSearchParams] = useSearchParams()
  const isGalleryMediaView = mediaView === "gallery"
  const galleryGroupKey = isGalleryMediaView ? searchParams.get("group") : null
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

  useEffect(() => {
    if (galleryGroupKey && !isPending && !openGalleryGroup) {
      setSearchParams({}, { replace: true })
    }
  }, [galleryGroupKey, isPending, openGalleryGroup, setSearchParams])

  const exitGroup = () => setSearchParams({}, { replace: true })
  const openGroup = (groupKey: string) => setSearchParams({ group: groupKey })

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
