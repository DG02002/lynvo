import type { ExtractedLink } from "~/features/links/types"
import {
  collectSelectableLinkIds,
  getSelectableLinkId,
  isAllChildrenSelected,
} from "./link-selection-utils"
import { getMediaNodeInteractionState } from "~/features/links/media-node-interaction"

export const getLinkSelectionState = (
  link: ExtractedLink,
  selectedIds: Set<string>
) => {
  const linkId = getSelectableLinkId(link)
  const interaction = getMediaNodeInteractionState(link)
  const { isFolder, isSelectable } = interaction
  const hasChildren = Boolean(link.children?.length)
  const { canExpand } = interaction
  const isSelectionControlAvailable =
    isSelectable || collectSelectableLinkIds(link.children ?? []).length > 0

  return {
    linkId,
    isFolder,
    isSelectable,
    isSelectionControlAvailable,
    hasChildren,
    canExpand,
    isSelected:
      isSelectionControlAvailable &&
      (selectedIds.has(linkId) ||
        (isFolder &&
          hasChildren &&
          link.children!.every((child) =>
            isAllChildrenSelected(child, selectedIds)
          ))),
  }
}
