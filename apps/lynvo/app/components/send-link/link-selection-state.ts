import type { ExtractedLink } from "~/features/links/types"
import {
  getSelectableLinkId,
  hasSelectedDescendant,
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
  const canExpand = interaction.canExpand

  return {
    linkId,
    isFolder,
    isSelectable,
    hasChildren,
    canExpand,
    isSelected: isSelectable
      ? selectedIds.has(linkId) ||
        (isFolder &&
          hasChildren &&
          link.children!.every((child) =>
            isAllChildrenSelected(child, selectedIds)
          ))
      : false,
    hasSelectedChild: hasSelectedDescendant(link, selectedIds),
  }
}
