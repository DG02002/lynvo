import { useCallback, useState } from "react"
import { toast } from "sonner"
import type { RecentLinkViewItem } from "~/features/links/types"
import type { ExtractionPreview } from "./action-types"
import type { LinkCardActions } from "~/features/links/link-card-actions"
import type { RecentLinksActions } from "~/features/links/use-recent-links/actions"
import {
  useExtractingItems,
  useOpeningState,
  useSelectionDialog,
} from "./interaction-state"
import { usePlaybackActions } from "./playback-actions"
import { useRefreshActions } from "./refresh-actions"
import { useSaveActions } from "./save-actions"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
import { attachResolvedChildren } from "~/features/links/link-tree-metadata"

interface UseLinkActionsProps {
  recents: RecentLinkViewItem[]
  recentLinks: RecentLinksActions
  setHighlightedId: (id: string | null) => void
  setSortOrder: (order: "newest" | "oldest") => void
  setCurrentPage: (page: number) => void
}

export function useLinkActions({
  recents,
  recentLinks,
  setHighlightedId,
  setSortOrder,
  setCurrentPage,
}: UseLinkActionsProps) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [extractionPreview, setExtractionPreview] =
    useState<ExtractionPreview | null>(null)

  const {
    selectionDialogState,
    setSelectionDialogState,
    openSelectionDialog,
    closeSelectionDialog,
  } = useSelectionDialog()
  const { isOpening, setIsOpening, isOpeningRef, resetOpeningWhenReady } =
    useOpeningState()
  const { extractingItems, runWithExtractingItem } = useExtractingItems()
  const { handleRecentClick } = usePlaybackActions({
    isOpeningRef,
    setIsOpening,
    resetOpeningWhenReady,
  })
  const {
    handleShowLinks,
    handleExpandFolder,
    handleSoftRefresh,
    handleHardRefresh,
    handleMirrorExpand,
  } = useRefreshActions({
    recents,
    updateRecentLinks: recentLinks.updateLinks,
    cacheResolvedMirrors: recentLinks.cacheResolvedMirrors,
    openSelectionDialog,
    extractingItems,
    runWithExtractingItem,
  })
  const linkCardActions: LinkCardActions = {
    play: handleRecentClick,
    showLinks: handleShowLinks,
    remove: recentLinks.remove,
    markWatched: recentLinks.markWatched,
    removeLink: recentLinks.removeLink,
    expandFolder: handleExpandFolder,
    softRefresh: handleSoftRefresh,
    hardRefresh: handleHardRefresh,
    expandMirror: handleMirrorExpand,
    setAsCurrent: recentLinks.setPlayableItemAsCurrent,
  }
  const {
    isSaving,
    handleSave,
    confirmSelection,
    saveSelectionDraft,
    pluginDomainDialog,
  } = useSaveActions({
    url,
    recents,
    addRecent: recentLinks.add,
    updateRecentLinks: recentLinks.updateLinks,
    openSelectionDialog,
    setExtractionPreview,
    closeSelectionDialog,
    selectionDialogState,
    setError,
    setCurrentUrl: setUrl,
    setHighlightedId,
    setSortOrder,
    setCurrentPage,
  })

  const expandSelectionFolder = useCallback(
    async (linkId: string, linkUrl: string) => {
      const originalUrl = selectionDialogState.originalUrl
      try {
        const resolvedChildren = await extractionOrchestration.resolveFolder({
          folderUrl: linkUrl,
          workerId: selectionDialogState.meta.workerId,
          sourceId: selectionDialogState.meta.sourceId,
        })
        setSelectionDialogState((currentState) =>
          currentState.originalUrl === originalUrl
            ? {
                ...currentState,
                links: attachResolvedChildren({
                  links: currentState.links,
                  linkId,
                  linkUrl,
                  resolvedChildren,
                }),
              }
            : currentState
        )
        return resolvedChildren
      } catch (error) {
        console.error(error)
        toast.error("Unable to load this folder. Try again.")
        return null
      }
    },
    [
      selectionDialogState.meta.workerId,
      selectionDialogState.originalUrl,
      setSelectionDialogState,
    ]
  )

  return {
    input: {
      url,
      setUrl,
      error,
      setError,
      extractionPreview,
      handleSave,
    },
    isSaving,
    isOpening,
    extractingItems,
    linkCardActions,
    selectionDialog: {
      state: selectionDialogState,
      setOpen: (open: boolean) =>
        setSelectionDialogState((prev) => ({ ...prev, open })),
      display: {
        pluginIcon:
          selectionDialogState.meta?.sourceIconUrl ||
          selectionDialogState.meta?.pluginIcon,
        pluginName:
          selectionDialogState.meta?.sourceName ||
          selectionDialogState.meta?.pluginName,
        pageTitle:
          selectionDialogState.meta?.pageTitle ||
          selectionDialogState.meta?.filename,
        audioInfo: selectionDialogState.meta?.audio,
        isDraftMode: selectionDialogState.isDraftMode,
        workerId: selectionDialogState.meta?.workerId,
      },
      confirmSelection,
      saveSelectionDraft,
      expandFolder: expandSelectionFolder,
    },
    pluginDomainDialog,
  }
}
