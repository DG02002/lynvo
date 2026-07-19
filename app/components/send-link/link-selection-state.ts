import type { ExtractedLink } from "~/features/links/types"
import {
  getSelectableLinkId,
  hasSelectedDescendant,
  isAllChildrenSelected,
} from "./link-selection-utils"

export const getLinkSelectionState = (
  link: ExtractedLink,
  selectedIds: Set<string>
) => {
  const linkId = getSelectableLinkId(link)
  const isFolder = link.type === "folder"
  const isSelectable =
    link.selectable === true || (!isFolder && link.selectable !== false)
  const hasChildren = Boolean(link.children?.length)
  const canExpand = isFolder && hasChildren

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
