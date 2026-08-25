import { useCallback, useState } from "react"
import { showErrorToast } from "~/lib/toast-notifications"
import type { LinkListItem } from "~/features/links/types"
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
import { useShouldAutoSaveAllLinks } from "~/features/site/settings/auto-save-links-preference"

interface UseLinkActionsProps {
  links: LinkListItem[]
  linkActions: LinksActions
  setHighlightedId: (id: string | null) => void
}

export function useLinkActions({
  links,
  linkActions,
  setHighlightedId,
}: UseLinkActionsProps) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [extractionPreview, setExtractionPreview] =
    useState<ExtractionPreview | null>(null)
  const savedLinks = links.filter((item) => item.kind === "saved")
  const shouldAutoSaveAllLinks = useShouldAutoSaveAllLinks()

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
    links: savedLinks,
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
    markOpened: linkActions.markOpened,
    removeLink: linkActions.removeLink,
    expandFolder: handleExpandFolder,
    softRefresh: handleSoftRefresh,
    hardRefresh: handleHardRefresh,
    expandMirror: handleMirrorExpand,
  }
  const { isSaving, handleSave, confirmSelection, pluginDomainDialog } =
    useSaveActions({
      url,
      links: savedLinks,
      addLink: linkActions.add,
      enqueueLink: linkActions.enqueue,
      updateLinks: linkActions.updateLinks,
      openSelectionDialog,
      setExtractionPreview,
      closeSelectionDialog,
      selectionDialogState,
      setError,
      setCurrentUrl: setUrl,
      setHighlightedId,
      shouldAutoSaveAllLinks,
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
        showErrorToast({ title: "The folder couldn’t be opened. Try again." })
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
      },
      confirmSelection,
      expandFolder: expandSelectionFolder,
    },
    pluginDomainDialog,
  }
}
