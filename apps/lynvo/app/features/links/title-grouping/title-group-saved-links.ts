import type { LinkListItem } from "../types"

export const getUniqueGroupSavedLinks = (
  group: TitleGroupProjection,
  itemsById: ReadonlyMap<string, LinkListItem>
): LinkListItem[] => {
  const savedLinksById = new Map<string, LinkListItem>()
  for (const entry of group.entries) {
    for (const source of entry.sources) {
      const savedLink = itemsById.get(source.savedLinkId)
      if (savedLink?.id) {
        savedLinksById.set(savedLink.id, savedLink)
      }
    }
  }
  return [...savedLinksById.values()]
}
