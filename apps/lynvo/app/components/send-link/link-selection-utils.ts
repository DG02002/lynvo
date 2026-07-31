import type { ExtractedLink } from "~/features/links/types"

export const getSelectableLinkId = (link: ExtractedLink) => link.id || link.url

export const collectLinkAndDescendantIds = (link: ExtractedLink): string[] => [
  getSelectableLinkId(link),
  ...(link.children?.flatMap(collectLinkAndDescendantIds) ?? []),
]

export const collectSelectableLinkIds = (
  links: readonly ExtractedLink[]
): string[] =>
  links.flatMap((link) => {
    const isFolder = link.type === "folder"
    const isSelectable =
      link.selectable === true || (!isFolder && link.selectable !== false)
    return [
      ...(isSelectable ? [getSelectableLinkId(link)] : []),
      ...collectSelectableLinkIds(link.children ?? []),
    ]
  })

const isLinkOrDescendantSelected = (
  link: ExtractedLink,
  selectedIds: Set<string>
): boolean => {
  const linkId = getSelectableLinkId(link)
  if (selectedIds.has(linkId)) {
    return true
  }

  return (
    link.children?.some((child) =>
      isLinkOrDescendantSelected(child, selectedIds)
    ) ?? false
  )
}

export const hasSelectedDescendant = (
  link: ExtractedLink,
  selectedIds: Set<string>
): boolean =>
  link.children?.some((child) =>
    isLinkOrDescendantSelected(child, selectedIds)
  ) ?? false

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
  if (link.type !== "folder") {
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
