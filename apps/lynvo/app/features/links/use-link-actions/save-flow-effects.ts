import type { MetaData } from "~/features/links/types"
import type { OpenSelectionDialogOptions } from "./action-types"
import { clearHighlightAfterDelay, resetSaveView } from "./save-feedback"

export interface SaveFlowEffects {
  clearError: () => void
  showError: (message: string) => void
  clearPreview: () => void
  showPreview: (meta: MetaData) => void
  openSelection: (options: OpenSelectionDialogOptions) => void
  closeSelection: () => void
  focusRecent: (id: string) => void
  resetAfterSave: () => void
}

export const createSaveFlowEffects = ({
  setError,
  setExtractionPreview,
  openSelectionDialog,
  closeSelectionDialog,
  setCurrentUrl,
  setHighlightedId,
  setSortOrder,
  setCurrentPage,
}: {
  setError: (error: string | null) => void
  setExtractionPreview: (preview: { meta: MetaData } | null) => void
  openSelectionDialog: (options: OpenSelectionDialogOptions) => void
  closeSelectionDialog: () => void
  setCurrentUrl: (url: string) => void
  setHighlightedId: (id: string | null) => void
  setSortOrder: (order: "newest" | "oldest") => void
  setCurrentPage: (page: number) => void
}): SaveFlowEffects => ({
  clearError: () => setError(null),
  showError: setError,
  clearPreview: () => setExtractionPreview(null),
  showPreview: (meta) => setExtractionPreview({ meta }),
  openSelection: openSelectionDialog,
  closeSelection: closeSelectionDialog,
  focusRecent: (id) => {
    setHighlightedId(id)
    setSortOrder("newest")
    setCurrentPage(1)
    clearHighlightAfterDelay(setHighlightedId)
  },
  resetAfterSave: () => {
    resetSaveView({ setCurrentUrl, setSortOrder, setCurrentPage })
  },
})
