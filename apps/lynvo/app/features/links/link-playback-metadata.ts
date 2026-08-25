import type { ExtractedLink, LinkMetadata } from "./types"
import { mergeUnique } from "./link-tree-metadata"
import { getMediaNodeTargetOrUndefined } from "./media-node-interaction"

export const applyOpenedState = (
  links: ExtractedLink[],
  openedUrls: Set<string>
): ExtractedLink[] =>
  links.map((link) => {
    const target = getMediaNodeTargetOrUndefined(link)
    const updated = {
      ...link,
      opened: target !== undefined && openedUrls.has(target),
    }
    if (!link.children) {
      return updated
    }
    return {
      ...updated,
      children: applyOpenedState(link.children, openedUrls),
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
