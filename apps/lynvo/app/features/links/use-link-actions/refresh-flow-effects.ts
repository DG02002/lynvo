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
  updateLinks,
  openSelectionDialog,
  extractingItems,
  runWithExtractingItem,
}: {
  updateLinks: (url: string, links: ExtractedLink[]) => void
  openSelectionDialog: (options: OpenSelectionDialogOptions) => void
  extractingItems: Set<string>
  runWithExtractingItem: <T>(
    itemKey: string,
    task: () => Promise<T>
  ) => Promise<T>
}): RefreshFlowEffects => ({
  updateLinks,
  openSelection: openSelectionDialog,
  runExtracting: runWithExtractingItem,
  isExtracting: (itemKey) => extractingItems.has(itemKey),
  showRefreshSuccess: () => toast.success("Links refreshed"),
  showNoLinks: () =>
    toast.error("No supported links are available. Try another Source page."),
  showRefreshError: () =>
    toast.error("The saved link couldn’t be refreshed. Try again."),
  showReselectError: () =>
    toast.error("Link choices couldn’t be loaded. Try again."),
  showMirrorError: () =>
    toast.error("Playable links couldn’t be loaded. Try again."),
  showOptionsError: () =>
    toast.error("Playback options couldn’t be loaded. Try again."),
})
