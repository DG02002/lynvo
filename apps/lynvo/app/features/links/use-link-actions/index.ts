import { useCallback, useState } from "react"
import { toast } from "sonner"
import type { LinkViewItem } from "~/features/links/types"
import type { ExtractionPreview } from "./action-types"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { LinksActions } from "~/features/links/use-links/actions"
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
  links: LinkViewItem[]
  linkActions: LinksActions
  setHighlightedId: (id: string | null) => void
  setSortOrder: (order: "newest" | "oldest") => void
  setCurrentPage: (page: number) => void
}

export function useLinkActions({
  links,
  linkActions,
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
  const { handleLinkClick } = usePlaybackActions({
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
    links,
    updateLinks: linkActions.updateLinks,
    cacheResolvedMirrors: linkActions.cacheResolvedMirrors,
    openSelectionDialog,
    extractingItems,
    runWithExtractingItem,
  })
  const linkItemActions: LinkItemActions = {
    play: handleLinkClick,
    showLinks: handleShowLinks,
    remove: linkActions.remove,
    markWatched: linkActions.markWatched,
    removeLink: linkActions.removeLink,
    expandFolder: handleExpandFolder,
    softRefresh: handleSoftRefresh,
    hardRefresh: handleHardRefresh,
    expandMirror: handleMirrorExpand,
    setAsCurrent: linkActions.setPlayableItemAsCurrent,
  }
  const {
    isSaving,
    handleSave,
    confirmSelection,
    saveSelectionDraft,
    pluginDomainDialog,
  } = useSaveActions({
    url,
    links,
    addLink: linkActions.add,
    updateLinks: linkActions.updateLinks,
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
          pluginServerId: selectionDialogState.meta.pluginServerId,
          pluginId: selectionDialogState.meta.pluginId,
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
        toast.error("The folder couldn’t be opened. Try again.")
        return null
      }
    },
    [
      selectionDialogState.meta.pluginId,
      selectionDialogState.meta.pluginServerId,
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
    linkItemActions,
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
      },
      confirmSelection,
      saveSelectionDraft,
      expandFolder: expandSelectionFolder,
    },
    pluginDomainDialog,
  }
}
