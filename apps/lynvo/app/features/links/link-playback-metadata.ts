import type { ExtractedLink, LinkMetadata } from "./types"
import { mergeUnique } from "./link-tree-metadata"
import { getMediaNodeTargetOrUndefined } from "./media-node-interaction"

export const applyOpenedState = (
  links: ExtractedLink[],
  openedUrls: Set<string>,
  openedIds: Set<string>
): ExtractedLink[] =>
  links.map((link) => {
    const target = getMediaNodeTargetOrUndefined(link)
    const isOpened =
      (target ? openedUrls.has(target) : false) ||
      (link.id ? openedIds.has(link.id) : false)

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
  metadata: LinkMetadata,
  linkUrl: string
): LinkMetadata => {
  return {
    ...metadata,
    playback: {
      ...metadata.playback,
      openedUrls: mergeUnique(metadata.playback.openedUrls, [linkUrl]),
    },
  }
}

export const withResolvedMirrors = (
  metadata: LinkMetadata,
  lazyItemUrl: string,
  mirrors: ExtractedLink[]
): LinkMetadata => {
  return {
    ...metadata,
    playback: {
      ...metadata.playback,
      resolvedMirrors: {
        ...metadata.playback.resolvedMirrors,
        [lazyItemUrl]: mirrors,
      },
    },
  }
}
