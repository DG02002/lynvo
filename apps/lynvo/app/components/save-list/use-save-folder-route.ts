import { useEffect, useMemo } from "react"
import { useLocation, useNavigate, useParams } from "react-router"

import type { LinkListItem, SavedLinkListItem } from "~/features/links/types"
import { savePaths } from "~/lib/paths"

import {
  createSaveListScrollLocationState,
  getSaveListScrollPosition,
} from "./use-save-list-fullscreen"

export const useSaveFolderRoute = (
  items: LinkListItem[],
  isPending: boolean
) => {
  const { savedLinkId } = useParams<{ savedLinkId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const selectedItemUrl = useMemo(() => {
    if (!savedLinkId) {
      return null
    }
    return (
      items.find((item) => item.kind === "saved" && item.id === savedLinkId)
        ?.url ?? null
    )
  }, [items, savedLinkId])

  useEffect(() => {
    if (savedLinkId && !isPending && !selectedItemUrl) {
      void navigate(savePaths.root, { replace: true })
    }
  }, [isPending, navigate, savedLinkId, selectedItemUrl])

  return {
    selectedItemUrl,
    isFolderRoute: Boolean(savedLinkId),
    openSavedFolder: (itemUrl: string, scrollPosition: number) => {
      const savedLink = items.find(
        (item): item is SavedLinkListItem =>
          item.kind === "saved" && item.url === itemUrl && item.id !== undefined
      )
      if (savedLink?.id) {
        void navigate(
          `${savePaths.folderPrefix}${encodeURIComponent(savedLink.id)}`,
          { state: createSaveListScrollLocationState(scrollPosition) }
        )
      }
    },
    closeSavedFolder: () =>
      void navigate(savePaths.root, {
        replace: true,
        state: createSaveListScrollLocationState(
          getSaveListScrollPosition(location.state) ?? 0
        ),
      }),
  }
}
