import type { ExtractedLink, LinkMetadataV2 } from "./types"
import { normalizeLinkMetadata } from "./link-metadata-normalization"
import { mergeUnique } from "./link-tree-metadata"

export const applyWatchedState = (
  links: ExtractedLink[],
  watchedUrls: Set<string>,
  watchedIds: Set<string>
): ExtractedLink[] =>
  links.map((link) => {
    const isWatched =
      watchedUrls.has(link.url) || (link.id ? watchedIds.has(link.id) : false)

    return {
      ...link,
      watched: isWatched,
      ...(link.children
        ? {
            children: applyWatchedState(link.children, watchedUrls, watchedIds),
          }
        : {}),
    }
  })

export const withWatchedUrl = (
  metadata: unknown,
  linkUrl: string
): LinkMetadataV2 => {
  const normalized = normalizeLinkMetadata(metadata)
  return {
    ...normalized,
    playback: {
      ...normalized.playback,
      watchedUrls: mergeUnique(normalized.playback.watchedUrls, [linkUrl]),
    },
  }
}

export const withResolvedMirrors = (
  metadata: unknown,
  lazyItemUrl: string,
  mirrors: ExtractedLink[]
): LinkMetadataV2 => {
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
