import { toast } from "sonner"
import type { ExtractedLink } from "~/features/links/types"
import type { OpenSelectionDialogOptions } from "./action-types"

export interface RefreshFlowEffects {
  updateLinks: (url: string, links: ExtractedLink[]) => void
  openSelection: (options: OpenSelectionDialogOptions) => void
  runExtracting: <T>(itemKey: string, task: () => Promise<T>) => Promise<T>
  isExtracting: (itemKey: string) => boolean
  showRefreshSuccess: () => void
  showNoLinks: () => void
  showRefreshError: () => void
  showReselectError: () => void
  showMirrorError: () => void
  showOptionsError: () => void
}

export const createRefreshFlowEffects = ({
  updateRecentLinks,
  openSelectionDialog,
  extractingItems,
  runWithExtractingItem,
}: {
  updateRecentLinks: (url: string, links: ExtractedLink[]) => void
  openSelectionDialog: (options: OpenSelectionDialogOptions) => void
  extractingItems: Set<string>
  runWithExtractingItem: <T>(
    itemKey: string,
    task: () => Promise<T>
  ) => Promise<T>
}): RefreshFlowEffects => ({
  updateLinks: updateRecentLinks,
  openSelection: openSelectionDialog,
  runExtracting: runWithExtractingItem,
  isExtracting: (itemKey) => extractingItems.has(itemKey),
  showRefreshSuccess: () => toast.success("Links refreshed"),
  showNoLinks: () => toast.error("No links found"),
  showRefreshError: () => toast.error("Unable to refresh links. Try again."),
  showReselectError: () =>
    toast.error("Unable to select links again. Try again."),
  showMirrorError: () => toast.error("Unable to resolve mirrors. Try again."),
  showOptionsError: () => toast.error("Unable to load options. Try again."),
})
