import type { ExtractedLink } from "~/features/links/types"
import {
  getMediaNodeInteractionState,
  getMediaNodeKey,
} from "~/features/links/media-node-interaction"

export const getSelectableLinkId = getMediaNodeKey

export const collectLinkAndDescendantIds = (link: ExtractedLink): string[] => [
  getSelectableLinkId(link),
  ...(link.children?.flatMap(collectLinkAndDescendantIds) ?? []),
]

export const collectSelectableLinkIds = (
  links: readonly ExtractedLink[]
): string[] =>
  links.flatMap((link) => {
    const isSelectable = getMediaNodeInteractionState(link).isSelectable
    return [
      ...(isSelectable ? [getSelectableLinkId(link)] : []),
      ...collectSelectableLinkIds(link.children ?? []),
    ]
  })

export const collectSelectedLinks = (
  links: ExtractedLink[],
  selectedIds: Set<string>
): ExtractedLink[] => {
  return links.flatMap((link) => {
    const linkId = getSelectableLinkId(link)
    if (selectedIds.has(linkId)) {
      return [link]
    }
    if (link.children) {
      return collectSelectedLinks(link.children, selectedIds)
    }
    return []
  })
}

export const isAllChildrenSelected = (
  link: ExtractedLink,
  selectedIds: Set<string>
): boolean => {
  const linkId = getSelectableLinkId(link)
  if (!getMediaNodeInteractionState(link).isFolder) {
    return selectedIds.has(linkId)
  }
  if (!link.children || link.children.length === 0) {
    return selectedIds.has(linkId)
  }
  return (
    selectedIds.has(linkId) ||
    link.children.every((child) => isAllChildrenSelected(child, selectedIds))
  )
}
