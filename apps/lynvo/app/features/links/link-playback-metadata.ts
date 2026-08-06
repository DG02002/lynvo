import type { ExtractedLink, LinkMetadata } from "./types"
import { normalizeLinkMetadata } from "./link-metadata-normalization"
import { mergeUnique } from "./link-tree-metadata"

export const applyOpenedState = (
  links: ExtractedLink[],
  openedUrls: Set<string>,
  openedIds: Set<string>
): ExtractedLink[] =>
  links.map((link) => {
    const isOpened =
      openedUrls.has(link.url) || (link.id ? openedIds.has(link.id) : false)

    return {
      ...link,
      opened: isOpened,
      ...(link.children
        ? {
            children: applyOpenedState(link.children, openedUrls, openedIds),
          }
        : {}),
    }
  })

export const withOpenedUrl = (
  metadata: unknown,
  linkUrl: string
): LinkMetadata => {
  const normalized = normalizeLinkMetadata(metadata)
  return {
    ...normalized,
    playback: {
      ...normalized.playback,
      openedUrls: mergeUnique(normalized.playback.openedUrls, [linkUrl]),
    },
  }
}

export const withResolvedMirrors = (
  metadata: unknown,
  lazyItemUrl: string,
  mirrors: ExtractedLink[]
): LinkMetadata => {
  const normalized = normalizeLinkMetadata(metadata)
  return {
    ...normalized,
    playback: {
      ...normalized.playback,
      resolvedMirrors: {
        ...normalized.playback.resolvedMirrors,
        [lazyItemUrl]: mirrors,
      },
    },
  }
}
