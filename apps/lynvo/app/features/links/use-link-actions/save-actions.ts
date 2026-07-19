import { useState } from "react"
import { toast } from "sonner"
import type {
  ExtractedLink,
  MetaData,
  RecentLinkViewItem,
} from "~/features/links/types"
import { writeDraft } from "~/components/links/DraftManager"
import { confirmSelectedLinks, saveLink } from "./save-flow"
import type { SelectionDialogState } from "./interaction-state"
import type { OpenSelectionDialogOptions } from "./action-types"
import { createSaveFlowEffects } from "./save-flow-effects"
import { getSaveErrorMessage } from "./save-error-message"

export const useSaveActions = ({
  url,
  recents,
  addRecent,
  updateRecentLinks,
  openSelectionDialog,
  setExtractionPreview,
  closeSelectionDialog,
  selectionDialogState,
  setError,
  setCurrentUrl,
  setHighlightedId,
  setSortOrder,
  setCurrentPage,
}: {
  url: string
  recents: RecentLinkViewItem[]
  addRecent: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  updateRecentLinks: (url: string, links: ExtractedLink[]) => void
  openSelectionDialog: (options: OpenSelectionDialogOptions) => void
  setExtractionPreview: (preview: { meta: MetaData } | null) => void
  closeSelectionDialog: () => void
  selectionDialogState: SelectionDialogState
  setError: (error: string | null) => void
  setCurrentUrl: (url: string) => void
  setHighlightedId: (id: string | null) => void
  setSortOrder: (order: "newest" | "oldest") => void
  setCurrentPage: (page: number) => void
}) => {
  const [isSaving, setIsSaving] = useState(false)
  const effects = createSaveFlowEffects({
    setError,
    setExtractionPreview,
    openSelectionDialog,
    closeSelectionDialog,
    setCurrentUrl,
    setHighlightedId,
    setSortOrder,
    setCurrentPage,
  })

  const handleSave = async (overrideUrl?: string) => {
    if (isSaving) {
      return
    }
    setIsSaving(true)

    try {
      await saveLink({
        overrideUrl,
        currentUrl: url,
        recents,
        addRecent,
        effects,
      })
    } catch (error) {
      console.error(error)
      effects.clearPreview()
      effects.showError(getSaveErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const confirmSelection = async (selectedLinks: ExtractedLink[]) => {
    setIsSaving(true)
    try {
      const { originalUrl, meta, existingItemId } = selectionDialogState

      await confirmSelectedLinks({
        selectedLinks,
        originalUrl,
        meta,
        existingItemId,
        addRecent,
        updateRecentLinks,
        effects,
      })
    } catch (error) {
      console.error(error)
      effects.showError("Unable to save the selection. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const saveSelectionDraft = () => {
    const { originalUrl, links, meta } = selectionDialogState
    if (links.length > 0) {
      writeDraft(originalUrl, links, meta)
      toast.success("Draft saved")
    }
    closeSelectionDialog()
  }

  return { isSaving, handleSave, confirmSelection, saveSelectionDraft }
}
