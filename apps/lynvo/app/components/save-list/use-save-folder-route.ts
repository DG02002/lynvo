import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router"
import type { LinkListItem, SavedLinkListItem } from "~/features/links/types"

export const useSaveFolderRoute = (
  items: LinkListItem[],
  isHydrating: boolean
) => {
  const { savedLinkId } = useParams<{ savedLinkId: string }>()
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
    if (savedLinkId && !isHydrating && !selectedItemUrl) {
      void navigate("/save", { replace: true })
    }
  }, [isHydrating, navigate, savedLinkId, selectedItemUrl])

  return {
    selectedItemUrl,
    isFolderRoute: Boolean(savedLinkId),
    openSavedFolder: (itemUrl: string) => {
      const savedLink = items.find(
        (item): item is SavedLinkListItem =>
          item.kind === "saved" && item.url === itemUrl && item.id !== undefined
      )
      if (savedLink?.id) {
        void navigate(`/save/folder/${encodeURIComponent(savedLink.id)}`)
      }
    },
    closeSavedFolder: () => void navigate("/save"),
  }
}
